#!/usr/bin/env python3
"""Validate the legacy fixtures plus the v2 migration seed. No app/AWS tests."""
from __future__ import annotations
import json
import math
import re
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

def load(name: str):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))

catalog = load("config/catalog.demo.v1.json")
model = load("config/model.demo.v1.json")
runtime_seed = load("config/runtime.demo.v2.json")
fields = {f["id"]: f for f in catalog["fields"]}
assert len(fields) == len(catalog["fields"]) == 63
assert set(fields) == set(model["fields"])
assert model["status"] == "synthetic-demo"
assert model["notPopulationStatistics"] is True
assert model["catalogVersion"] == catalog["catalogVersion"]
assert 0 < model["adultFraction"] <= 1

v2_field_ids = set(fields) - {"residence"}
assert len(v2_field_ids) == 62
assert set(model["fields"]) - {"residence"} == v2_field_ids
assert runtime_seed["schemaVersion"] == "2.0.0"
assert runtime_seed["defaultCityId"] == "jp_tokyo"
assert {c["id"] for c in runtime_seed["cities"]} == {"jp_tokyo", "cn_shanghai", "cn_beijing", "jp_osaka"}
assert math.isclose(
    runtime_seed["cityResidualMass"] + sum(c["populationMass"] for c in runtime_seed["cities"] if c["status"] == "active"),
    1,
    abs_tol=1e-12,
)
assert [t["people"] for t in runtime_seed["reachTiers"]] == [2000, 5000, 10000]
assert [b["incrementRate"] for b in runtime_seed["reachBoosts"]] == [0.5, 0.25, 1]
assert [level["coefficient"] for level in runtime_seed["strictnessLevels"]] == [1, 0.8, 0.6, 0.4, 0]
assert sum(level["isDefault"] for level in runtime_seed["strictnessLevels"]) == 1

for fid, f in fields.items():
    fm = model["fields"][fid]
    d = fm["distribution"]
    s = fm["score"]
    if f["kind"] in ("enum", "tags"):
        ids = [o["id"] for o in f["options"]]
        assert len(ids) == len(set(ids)), fid
        assert set(d["mass"]) == set(ids), fid
        assert all(0 <= p <= 1 for p in d["mass"].values()), fid
        if d["kind"] == "categorical":
            assert math.isclose(sum(d["mass"].values()), 1, abs_tol=1e-12), fid
        for preset in f["presets"]:
            assert set(preset["values"]) <= set(ids), fid
    else:
        buckets = d["buckets"]
        assert buckets[0]["from"] == f["minimum"], fid
        assert buckets[-1]["toExclusive"] == f["maximum"] + f["step"], fid
        assert math.isclose(sum(b["mass"] for b in buckets), 1, abs_tol=1e-12), fid
        for i, b in enumerate(buckets):
            assert b["from"] < b["toExclusive"] and 0 <= b["mass"] <= 1, fid
            if i:
                assert buckets[i-1]["toExclusive"] == b["from"], fid
        for preset in f["presets"]:
            assert preset["op"] in f["allowedOperators"], fid
    if s["kind"] == "excluded":
        assert not f["scoreEnabled"] and s["weight"] == 0, fid
    elif s["kind"] == "category_map":
        assert f["scoreEnabled"] and s["weight"] > 0, fid
        assert set(s["values"]) == {o["id"] for o in f["options"]}, fid
        assert all(0 <= v <= 100 for v in s["values"].values()), fid
    else:
        knots = s["knots"]
        assert f["scoreEnabled"] and s["weight"] > 0, fid
        assert knots[0]["value"] <= f["minimum"], fid
        assert knots[-1]["value"] >= f["maximum"], fid
        assert all(0 <= k["score"] <= 100 for k in knots), fid
        assert all(knots[i]["value"] < knots[i+1]["value"] for i in range(len(knots)-1)), fid


def resolve(fid: str, p: dict, own: dict):
    if p["op"] != "relative":
        return p
    a = own.get(p["sourceField"])
    if not a or a.get("state") != "answered" or not isinstance(a.get("value"), (int,float)):
        raise ValueError("missing_relative_source")
    v = a["value"]
    if p["comparison"] == "between":
        lo, hi = v+p["minOffset"], v+p["maxOffset"]
        if fid == "age":
            lo = max(18,lo)
        return {"op":"between", "min":lo, "max":hi}
    return {"op":p["comparison"], "value":v+p["offset"]}


def bounds(fid: str, p: dict):
    f = fields[fid]
    lo, hi = f["minimum"], f["maximum"]
    if p["op"] == "gte":
        lo = max(lo, p["value"])
    elif p["op"] == "lte":
        hi = min(hi, p["value"])
    elif p["op"] == "between":
        lo, hi = max(lo, p["min"]), min(hi, p["max"])
    else:
        raise ValueError(p)
    if lo > hi:
        raise ValueError("invalid_range")
    return lo, hi


def probability(fid: str, p: dict):
    f = fields[fid]
    d = model["fields"][fid]["distribution"]
    if d["kind"] == "categorical":
        return sum(d["mass"][v] for v in set(p["values"]))
    if d["kind"] == "independent_tags":
        return 1-math.prod(1-d["mass"][v] for v in set(p["values"]))
    lo, hi = bounds(fid,p)
    step=f["step"]
    total=0.0
    for b in d["buckets"]:
        n=round((b["toExclusive"]-b["from"])/step)
        first=max(0, math.ceil((lo-b["from"])/step))
        last=min(n-1, math.floor((hi-b["from"])/step))
        accepted=max(0, last-first+1)
        total += b["mass"]*accepted/n
    return total


def g(fid: str, value):
    s=model["fields"][fid]["score"]
    if s["kind"] == "category_map":
        return s["values"][value]
    ks=s["knots"]
    if value <= ks[0]["value"]:
        return ks[0]["score"]
    for a,b in zip(ks,ks[1:]):
        if value <= b["value"]:
            t=(value-a["value"])/(b["value"]-a["value"])
            return a["score"]+t*(b["score"]-a["score"])
    return ks[-1]["score"]


def project(fid: str, p: dict):
    s=model["fields"][fid]["score"]
    if s["kind"] == "category_map":
        return min(g(fid,v) for v in set(p["values"]))
    lo,hi=bounds(fid,p)
    xs=[lo,hi]+[k["value"] for k in s["knots"] if lo <= k["value"] <= hi]
    return min(g(fid,x) for x in xs)


def evaluate(inp: dict):
    own,req=inp["own"],inp["requirements"]
    n=model["basePopulation"]*model["adultFraction"]
    own_parts=[]; req_parts=[]
    for fid in fields:
        s=model["fields"][fid]["score"]
        r=req.get(fid,{"state":"any"})
        a=own.get(fid)
        if a and a["state"]=="answered" and s["weight"]:
            own_parts.append((g(fid,a["value"]),s["weight"]))
        if r["state"]=="required":
            p=resolve(fid,r["predicate"],own)
            n *= probability(fid,p)
            if s["weight"]:
                req_parts.append((project(fid,p),s["weight"]))
    def average(parts):
        return sum(v*w for v,w in parts)/sum(w for _,w in parts) if parts else None
    return {"population":n, "ownScore":average(own_parts), "requirementsScore":average(req_parts)}

fixture_report=[]
for case in load("examples/fixtures.demo.v1.json")["cases"]:
    result=evaluate(case["input"])
    for key,expected in case["expected"].items():
        if expected is None:
            assert result[key] is None, (case["id"],key,result[key])
        else:
            assert math.isclose(result[key],expected,rel_tol=1e-10,abs_tol=1e-8), (case["id"],key,result[key],expected)
    reverse_input={"own":case["input"]["own"],"requirements":dict(reversed(list(case["input"]["requirements"].items())))}
    assert math.isclose(evaluate(reverse_input)["population"],result["population"],rel_tol=1e-12)
    fixture_report.append({"id":case["id"],"result":result,"passed":True})

# Demonstrate exact same single values are scored equally and missing relative sources fail.
for fid,f in fields.items():
    if not f["scoreEnabled"]:
        continue
    if f["kind"]=="enum":
        v=f["options"][0]["id"]
        p={"op":"in","values":[v]}
    else:
        v=f["minimum"]
        p={"op":"between","min":v,"max":v}
    assert math.isclose(g(fid,v),project(fid,p),abs_tol=1e-12), fid
try:
    resolve("age",{"op":"relative","sourceField":"age","comparison":"between","minOffset":-3,"maxOffset":3},{})
    raise AssertionError("missing relative input silently accepted")
except ValueError as e:
    assert str(e)=="missing_relative_source"

# Ensure the reference contract follows the executable dynamic schema rather than
# restoring the removed fixed FieldId union.
contract=(ROOT/"contracts/domain.ts").read_text(encoding="utf-8")
assert "FieldId," in contract
assert "from '../packages/domain/src/index'" in contract
assert "export type FieldId =" not in contract

# Basic source reference and bundle completeness checks.
source_doc=(ROOT/"docs/09-sources-decisions.md").read_text(encoding="utf-8")
known_sources=set(re.findall(r"\[S(\d+)\]",source_doc))
for p in (ROOT/"docs").glob("*.md"):
    assert set(re.findall(r"\[S(\d+)\]",p.read_text(encoding="utf-8"))) <= known_sources, p
assert {str(i) for i in range(1, 21)} <= known_sources
for path in [
    "bootstrap.md", "AGENTS.md", "CONTEXT.md", "harness.json", "README.md",
    "config/runtime.demo.v2.json", "docs/01-product.md", "docs/09-sources-decisions.md",
    "docs/10-first-round-change-spec.md", "packages/config-workbook/package.json",
]:
    assert (ROOT/path).is_file(), path

report={
    "checkedAtUtc":datetime.now(timezone.utc).isoformat(),
    "scope":"legacy-fixtures-and-v2-migration-seed-only",
    "legacyFieldCount":len(fields),
    "v2QuestionCount":len(v2_field_ids),
    "scoreEnabledCount":sum(f["scoreEnabled"] for f in fields.values()),
    "fixtureCount":len(fixture_report),
    "configurationValid":True,
    "sourceReferenceCount":len(known_sources),
    "fixtures":fixture_report,
    "notValidatedByThisScript":["web-app","lambda","cdk-synth","pnpm-tests","real-dynamodb","browser","aws-deployment"],
}
(ROOT/"validation-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:report[k] for k in ("scope","legacyFieldCount","v2QuestionCount","scoreEnabledCount","fixtureCount","configurationValid")},ensure_ascii=False))
