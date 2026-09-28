import { useEffect, useMemo, useState } from 'react';
import type { CatalogField, CurrencyInput, FieldId, OwnAnswer, Predicate, Requirement } from '@tls/domain';
import {
  rarityLabel,
  type RuntimeEngine,
} from '@tls/engine';
import type { Draft } from './draft';

interface FieldCardProps {
  field: CatalogField;
  engine: RuntimeEngine;
  draft: Draft;
  onOwn: (fieldId: FieldId, answer?: OwnAnswer, currencyInput?: CurrencyInput) => void;
  onRequirement: (fieldId: FieldId, requirement: Requirement) => void;
}

function percent(value: number): string {
  if (value > 0 && value < 0.001) return '<0.1%';
  return `${(value * 100).toLocaleString('zh-CN', { maximumFractionDigits: value < 0.1 ? 1 : 0 })}%`;
}

function isCurrency(field: CatalogField): boolean {
  return field.unit?.startsWith('CNY') ?? false;
}

function fieldValueLabel(field: CatalogField, value: number): string {
  if (isCurrency(field)) {
    if (Math.abs(value) >= 10_000) return `${value / 10_000}万元`;
    return `${value}元`;
  }
  return `${value}${field.unit ?? ''}`;
}

function requirementValues(requirement: Requirement | undefined): string[] {
  if (requirement?.state !== 'required') return [];
  const predicate = requirement.predicate;
  return predicate.op === 'in' || predicate.op === 'any_of' ? predicate.values : [];
}

function numericEndpoints(field: CatalogField, engine: RuntimeEngine): number[] {
  const distribution = engine.config.model.fields[field.id]!.distribution;
  const values = new Set<number>();
  if (field.minimum !== undefined) values.add(field.minimum);
  if (field.maximum !== undefined) values.add(field.maximum);
  for (const preset of field.presets.filter((entry) => entry.status !== 'retired')) {
    if (preset.value !== undefined) values.add(preset.value);
    if (preset.min !== undefined) values.add(preset.min);
    if (preset.max !== undefined) values.add(preset.max);
  }
  if (distribution.kind === 'bucket_uniform_discrete') {
    for (const bucket of distribution.buckets) {
      values.add(bucket.from);
      values.add(bucket.toExclusive - (field.step ?? 1));
    }
  }
  return [...values]
    .filter((value) => value >= (field.minimum ?? value) && value <= (field.maximum ?? value))
    .sort((left, right) => left - right);
}

function OptionButton({
  label,
  active,
  coverage,
  onClick,
}: {
  label: string;
  active: boolean;
  coverage?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`choice ${active ? 'choice--active' : ''}`} aria-pressed={active} onClick={onClick}>
      <span>{label}</span>
      {coverage !== undefined && <small>{percent(coverage)}</small>}
    </button>
  );
}

function EnumOwn({ field, answer, onChange }: { field: CatalogField; answer?: OwnAnswer; onChange: (answer?: OwnAnswer) => void }) {
  const selected = answer?.state === 'answered' ? answer.value : undefined;
  const selectedValues = Array.isArray(selected) ? selected : selected ? [String(selected)] : [];
  const toggle = (value: string) => {
    if (field.kind !== 'tags') {
      onChange({ state: 'answered', value });
      return;
    }
    const next = selectedValues.includes(value)
      ? selectedValues.filter((entry) => entry !== value)
      : [...selectedValues, value];
    onChange(next.length ? { state: 'answered', value: next } : undefined);
  };
  return (
    <div className="choices">
      <OptionButton label="跳过" active={!answer || answer.state === 'skipped'} onClick={() => onChange(undefined)} />
      {(field.options ?? []).filter((option) => option.status !== 'retired').map((option) => (
        <OptionButton
          key={option.id}
          label={option.label}
          active={selectedValues.includes(option.id)}
          onClick={() => toggle(option.id)}
        />
      ))}
    </div>
  );
}

function NumberOwn({
  field,
  answer,
  currencyInput,
  engine,
  onChange,
}: {
  field: CatalogField;
  answer?: OwnAnswer;
  currencyInput?: CurrencyInput;
  engine: RuntimeEngine;
  onChange: (answer?: OwnAnswer, currencyInput?: CurrencyInput) => void;
}) {
  const [currency, setCurrency] = useState<'CNY' | 'JPY'>(currencyInput?.currency ?? 'CNY');
  const displayed = currencyInput?.originalValue ?? (answer?.state === 'answered' && typeof answer.value === 'number' ? answer.value : '');
  const setNumber = (raw: string) => {
    if (!raw) {
      onChange(undefined);
      return;
    }
    const number = Number(raw);
    if (!Number.isFinite(number)) return;
    if (isCurrency(field)) {
      const normalized = engine.normalizeCurrency(number, currency);
      onChange({ state: 'answered', value: normalized.normalizedCny }, normalized);
    } else {
      onChange({ state: 'answered', value: number });
    }
  };
  const switchCurrency = (next: 'CNY' | 'JPY') => {
    setCurrency(next);
    if (displayed !== '') {
      const normalized = engine.normalizeCurrency(Number(displayed), next);
      onChange({ state: 'answered', value: normalized.normalizedCny }, normalized);
    }
  };
  return (
    <div className="number-own">
      <label>
        <span className="sr-only">我的{field.label}</span>
        <input
          type="number"
          inputMode="decimal"
          min={isCurrency(field) && currency === 'JPY' ? undefined : field.minimum}
          max={isCurrency(field) && currency === 'JPY' ? undefined : field.maximum}
          step={field.step}
          value={displayed}
          placeholder="可跳过"
          onChange={(event) => setNumber(event.currentTarget.value)}
        />
      </label>
      {isCurrency(field) && (
        <select aria-label={`${field.label}币种`} value={currency} onChange={(event) => switchCurrency(event.target.value as 'CNY' | 'JPY')}>
          <option value="CNY">人民币</option>
          <option value="JPY">日元</option>
        </select>
      )}
      {!isCurrency(field) && <span className="unit">{field.unit}</span>}
      {currencyInput && <small>按演示汇率折合 {currencyInput.normalizedCny.toLocaleString('zh-CN')} 元人民币</small>}
      {answer && <button type="button" className="text-button" onClick={() => onChange(undefined)}>清除</button>}
    </div>
  );
}

function EnumRequirement({
  field,
  requirement,
  engine,
  onChange,
}: {
  field: CatalogField;
  requirement?: Requirement;
  engine: RuntimeEngine;
  onChange: (requirement: Requirement) => void;
}) {
  const selected = new Set(engine.expandOptionValues(field.id, requirementValues(requirement)));
  const operator = field.kind === 'tags' ? 'any_of' : 'in';
  const strictnessLevelId = requirement?.state === 'required'
    ? requirement.strictnessLevelId
    : engine.defaultStrictnessId();
  const apply = (values: Iterable<string>) => {
    const unique = [...new Set(values)];
    onChange(unique.length ? {
      state: 'required', predicate: { op: operator, values: unique }, strictnessLevelId,
    } : { state: 'any' });
  };
  const toggleValues = (values: string[]) => {
    const allSelected = values.every((value) => selected.has(value));
    const next = new Set(selected);
    for (const value of values) {
      if (allSelected) next.delete(value);
      else next.add(value);
    }
    apply(next);
  };
  return (
    <>
      <div className="choices">
        <OptionButton label="无要求" active={!requirement || requirement.state === 'any'} onClick={() => onChange({ state: 'any' })} />
        {field.presets.filter((preset) => preset.status !== 'retired' && preset.values).map((preset) => {
          const values = preset.values ?? [];
          return (
            <OptionButton
              key={preset.id ?? preset.label}
              label={preset.label}
              active={values.length > 0 && values.every((value) => selected.has(value))}
              coverage={engine.probabilityForPredicate(field.id, { op: operator, values })}
              onClick={() => toggleValues(values)}
            />
          );
        })}
        {(field.options ?? []).filter((option) => option.status !== 'retired').map((option) => (
          <OptionButton
            key={option.id}
            label={option.label}
            active={selected.has(option.id)}
            coverage={engine.probabilityForPredicate(field.id, { op: operator, values: [option.id] })}
            onClick={() => toggleValues([option.id])}
          />
        ))}
      </div>
      {field.kind === 'tags' && requirement?.state === 'required' && <small className="helper">所选爱好按“至少有一个”计算。</small>}
    </>
  );
}

function NumberRequirement({
  field,
  requirement,
  engine,
  onChange,
}: {
  field: CatalogField;
  requirement?: Requirement;
  engine: RuntimeEngine;
  onChange: (requirement: Requirement) => void;
}) {
  const endpoints = useMemo(() => numericEndpoints(field, engine), [engine, field]);
  const predicate = requirement?.state === 'required' ? requirement.predicate : undefined;
  const direct = predicate && predicate.op !== 'relative' && predicate.op !== 'in' && predicate.op !== 'any_of' ? predicate : undefined;
  const selectedMin = direct?.op === 'between' ? direct.min : direct?.op === 'gte' ? direct.value : endpoints[0];
  const selectedMax = direct?.op === 'between' ? direct.max : direct?.op === 'lte' ? direct.value : endpoints.at(-1);
  const strictnessLevelId = requirement?.state === 'required'
    ? requirement.strictnessLevelId
    : engine.defaultStrictnessId();
  const updateRange = (min: number, max: number) => {
    if (min > max) return;
    onChange({
      state: 'required', predicate: { op: 'between', min, max }, strictnessLevelId,
    });
  };
  return (
    <>
      <div className="choices">
        <OptionButton label="无要求" active={!requirement || requirement.state === 'any'} onClick={() => onChange({ state: 'any' })} />
        {field.presets.filter((preset) => preset.status !== 'retired').map((preset) => {
          let next: Exclude<Predicate, { op: 'relative' }> | undefined;
          if (preset.op === 'between' && preset.min !== undefined && preset.max !== undefined) {
            next = { op: 'between', min: preset.min, max: preset.max };
          } else if ((preset.op === 'gte' || preset.op === 'lte') && preset.value !== undefined) {
            next = { op: preset.op, value: preset.value };
          }
          if (!next) return null;
          return (
            <OptionButton
              key={preset.label}
              label={preset.label}
              active={Boolean(predicate && JSON.stringify(predicate) === JSON.stringify(next))}
              coverage={engine.probabilityForPredicate(field.id, next)}
              onClick={() => onChange({ state: 'required', predicate: next!, strictnessLevelId })}
            />
          );
        })}
        {(field.relativePresets ?? []).filter((preset) => preset.status !== 'retired').map((preset) => {
          const next: Predicate =
            preset.minOffset !== undefined && preset.maxOffset !== undefined
              ? {
                  op: 'relative',
                  sourceField: preset.sourceFieldId ?? field.id,
                  comparison: 'between',
                  minOffset: preset.minOffset,
                  maxOffset: preset.maxOffset,
                }
              : {
                  op: 'relative',
                  sourceField: preset.sourceFieldId ?? field.id,
                  comparison: preset.operator ?? 'gte',
                  offset: preset.offset ?? 0,
                };
          return (
            <OptionButton
              key={preset.label}
              label={preset.label}
              active={Boolean(predicate && JSON.stringify(predicate) === JSON.stringify(next))}
              onClick={() => onChange({ state: 'required', predicate: next, strictnessLevelId })}
            />
          );
        })}
      </div>
      <div className="range-selects">
        <label>
          最低
          <select
            value={selectedMin}
            onChange={(event) => updateRange(Number(event.target.value), Number(selectedMax))}
          >
            {endpoints.map((value) => <option key={value} value={value}>{fieldValueLabel(field, value)}</option>)}
          </select>
        </label>
        <span aria-hidden="true">—</span>
        <label>
          最高
          <select
            value={selectedMax}
            onChange={(event) => updateRange(Number(selectedMin), Number(event.target.value))}
          >
            {endpoints.map((value) => <option key={value} value={value}>{fieldValueLabel(field, value)}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}

export function FieldCard({ field, engine, draft, onOwn, onRequirement }: FieldCardProps) {
  const answer = draft.own[field.id];
  const requirement = draft.requirements[field.id];
  const coverage = useMemo(() => {
    if (requirement?.state !== 'required') return 1;
    const resolved = engine.resolvePredicate(field.id, requirement.predicate, draft.own);
    return resolved.predicate ? engine.probabilityForPredicate(field.id, resolved.predicate) : undefined;
  }, [draft.own, engine, field.id, requirement]);

  useEffect(() => {
    if (field.kind !== 'number' || requirement?.state !== 'required') return;
    const resolved = engine.resolvePredicate(field.id, requirement.predicate, draft.own);
    if (resolved.predicate?.op === 'between' && resolved.predicate.min > resolved.predicate.max) {
      onRequirement(field.id, { state: 'any' });
    }
  }, [draft.own, engine, field.id, field.kind, onRequirement, requirement]);

  return (
    <article className="field-card" id={`field-${field.id}`} data-field-id={field.id}>
      <header className="field-card__header">
        <div>
          <h3>{field.label}</h3>
          <span className="field-id">{field.id}</span>
        </div>
        {field.sensitive && <span className="sensitive">敏感问项 · 可跳过</span>}
      </header>
      <div className="field-card__columns">
        <section>
          <h4>我的情况</h4>
          {field.kind === 'number' ? (
            <NumberOwn
              field={field}
              answer={answer}
              currencyInput={draft.currencyInputs[field.id]}
              engine={engine}
              onChange={(nextAnswer, currencyInput) => onOwn(field.id, nextAnswer, currencyInput)}
            />
          ) : (
            <EnumOwn field={field} answer={answer} onChange={(nextAnswer) => onOwn(field.id, nextAnswer)} />
          )}
        </section>
        <section>
          <div className="requirement-heading">
            <h4>对方要求</h4>
            <span>{engine.describeRequirement(field.id, requirement ?? { state: 'any' })}</span>
          </div>
          {field.kind === 'number' ? (
            <NumberRequirement field={field} engine={engine} requirement={requirement} onChange={(next) => onRequirement(field.id, next)} />
          ) : (
            <EnumRequirement field={field} engine={engine} requirement={requirement} onChange={(next) => onRequirement(field.id, next)} />
          )}
          <div className="coverage" aria-label={coverage === undefined ? '此项等待补充自身情况' : `此项演示模型覆盖率 ${percent(coverage)}`}>
            <div className="coverage__meta">
              {coverage === undefined ? (
                <span>待补充自身条件，尚未计入</span>
              ) : (
                <><span>演示模型覆盖率 {percent(coverage)}</span><span>{rarityLabel(coverage)}</span></>
              )}
            </div>
            <div className="coverage__track"><span style={{ width: `${(coverage ?? 0) * 100}%` }} /></div>
          </div>
        </section>
      </div>
      <details className="field-note">
        <summary>说明</summary>
        <p>{field.note}</p>
      </details>
    </article>
  );
}

export function answeredCountForGroup(groupId: string, draft: Draft, engine: RuntimeEngine): number {
  return engine.fieldOrder.filter((fieldId) => {
    const id = fieldId as FieldId;
    return (
      engine.fieldsById[id]?.group === groupId &&
      (draft.own[id]?.state === 'answered' || draft.requirements[id]?.state === 'required')
    );
  }).length;
}
