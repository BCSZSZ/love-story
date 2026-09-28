import { describe, expect, it } from 'vitest';
import fixtures from '../../../examples/fixtures.demo.v1.json';
import type { NormalizedInput, Predicate, Requirement } from '@tls/domain';
import { DEFAULT_CONFIG_CHECKSUM, cloneRuntimeConfig, contextFor } from '@tls/model-config';
import {
  acceptanceEstimator,
  catalog,
  createRuntimeEngine,
  defaultEngine,
  defaultRuntimeConfig,
  evaluate,
  fieldOrder,
  fieldsById,
  formatExpectedCount,
  modelContext,
  populationEstimator,
  RelaxationGenerator,
} from '../src/index';

function v2Input(source: typeof fixtures.cases[number]['input']): NormalizedInput {
  const requirements = Object.fromEntries(
    Object.entries(source.requirements)
      .filter(([fieldId]) => fieldId !== 'residence')
      .map(([fieldId, requirement]) => [
        fieldId,
        requirement.state === 'required'
          ? { ...requirement, strictnessLevelId: 'must' }
          : requirement,
      ]),
  ) as NormalizedInput['requirements'];
  return {
    matchCityId: 'jp_tokyo',
    reach: { tierId: 'daily', boostIds: [] },
    own: source.own as NormalizedInput['own'],
    requirements,
    currencyInputs: {},
  };
}

describe('v1 hard-filter arithmetic preserved under the v2 city dimension', () => {
  for (const fixture of fixtures.cases) {
    it(fixture.id, () => {
      const input = v2Input(fixture.input);
      const result = evaluate(input, modelContext);
      const alreadyHadTokyoFilter = 'residence' in fixture.input.requirements;
      const expected = fixture.expected.population * (alreadyHadTokyoFilter ? 1 : 0.002);
      expect(result.population.expectedApprox).not.toBeNull();
      expect(Math.abs(result.population.expectedApprox! - expected) / Math.max(1, expected)).toBeLessThan(1e-10);
      expect(result.scores.own.score).toBe(fixture.expected.ownScore);
      expect(result.scores.requirements.score).toBe(fixture.expected.requirementsScore);
    });
  }

  it('does not depend on requirement insertion order', () => {
    const source = fixtures.cases.find((fixture) => fixture.id === 'worked_example')!;
    const input = v2Input(source.input);
    const reversed = { ...input, requirements: Object.fromEntries(Object.entries(input.requirements).reverse()) };
    expect(populationEstimator.estimate(reversed, modelContext).expectedApprox).toBeCloseTo(source.expected.population, 8);
  });

  it('marks missing relative sources as partial instead of treating them as zero', () => {
    const input: NormalizedInput = {
      matchCityId: 'jp_tokyo',
      reach: { tierId: 'daily', boostIds: [] },
      own: {},
      requirements: {
        age: {
          state: 'required', strictnessLevelId: 'must',
          predicate: { op: 'relative', sourceField: 'age', comparison: 'between', minOffset: -3, maxOffset: 3 },
        },
      },
      currencyInputs: {},
    };
    const result = populationEstimator.estimate(input, modelContext);
    expect(result.expectedApprox).toBeCloseTo(11_200_000, 4);
    expect(result.partial).toBe(true);
    expect(result.issues).toContainEqual(expect.objectContaining({ fieldId: 'age', code: 'missing_relative_source' }));
  });

  it('keeps future acceptance estimation explicitly unavailable', () => {
    expect(acceptanceEstimator.estimate({
      matchCityId: 'jp_tokyo', reach: { tierId: 'daily', boostIds: [] }, own: {}, requirements: {}, currencyInputs: {},
    }, modelContext)).toEqual({ status: 'not_implemented' });
  });
});

describe('configuration completeness', () => {
  it('has 62 dynamic question fields plus the top-level city input', () => {
    expect(catalog.fields).toHaveLength(62);
    expect(fieldOrder).toHaveLength(62);
    expect(catalog.fields.some((field) => field.id === 'residence')).toBe(false);
    for (const fieldId of fieldOrder) {
      const field = fieldsById[fieldId]!;
      let predicate: Predicate;
      if (field.kind === 'number') {
        const preset = field.presets[0]!;
        predicate = preset.op === 'between'
          ? { op: 'between', min: preset.min!, max: preset.max! }
          : { op: preset.op!, value: preset.value! } as Predicate;
      } else {
        predicate = { op: field.kind === 'tags' ? 'any_of' : 'in', values: [field.options![0]!.id] };
      }
      const result = populationEstimator.estimate({
        matchCityId: 'jp_tokyo', reach: { tierId: 'daily', boostIds: [] }, own: {},
        requirements: { [fieldId]: { state: 'required', strictnessLevelId: 'must', predicate } }, currencyInputs: {},
      }, modelContext);
      const step = result.trace.find((entry) => entry.fieldId === fieldId);
      expect(step, fieldId).toBeDefined();
      expect(step!.rawCoefficient, fieldId).toBeGreaterThan(0);
      expect(step!.rawCoefficient, fieldId).toBeLessThan(1);
    }
  });

  it('loads an administrator-added question without a code-level FieldId change', () => {
    const config = cloneRuntimeConfig();
    config.configBundleVersion = 'bundle-test-added-field';
    config.catalog.catalogVersion = 'catalog-test-added-field';
    config.model.catalogVersion = 'catalog-test-added-field';
    config.model.modelVersion = 'model-test-added-field';
    config.catalog.fields.push({
      id: 'community_role', label: '社区参与', group: 'lifestyle', kind: 'enum', status: 'active',
      selfControl: 'single_choice', requirementControl: 'acceptable_multi_choice', allowedOperators: ['in'],
      requiredSelf: false, sensitive: false, sourceItem: '管理员新增', note: '演示新增问题。', scoreEnabled: false,
      options: [{ id: 'yes', label: '是' }, { id: 'no', label: '否' }], presets: [],
    });
    config.model.fields.community_role = {
      distribution: { kind: 'categorical', mass: { yes: 0.3, no: 0.7 } }, score: { kind: 'excluded', weight: 0 },
    };
    const engine = createRuntimeEngine(config, 'test');
    const result = engine.estimate({
      matchCityId: 'jp_tokyo', reach: { tierId: 'daily', boostIds: [] }, own: {}, currencyInputs: {},
      requirements: { community_role: { state: 'required', strictnessLevelId: 'must', predicate: { op: 'in', values: ['yes'] } } },
    }, contextFor(config));
    expect(result.expectedApprox).toBeCloseTo(3_360_000, 4);
  });
});

describe('city, reach, boosts and strictness', () => {
  const requirements: NormalizedInput['requirements'] = {
    gender: { state: 'required', strictnessLevelId: 'must', predicate: { op: 'in', values: ['female'] } },
    age: { state: 'required', strictnessLevelId: 'negotiable', predicate: { op: 'between', min: 25, max: 34 } },
  };

  it('matches the confirmed combined formula and applies the city exactly once', () => {
    const result = defaultEngine.estimate({
      matchCityId: 'jp_tokyo', reach: { tierId: 'daily', boostIds: ['friends'] }, own: {}, requirements, currencyInputs: {},
    });
    expect(result.expectedApprox).toBeCloseTo(3_015_936, 6);
    expect(result.effectiveReach).toBe(3_000);
    expect(result.reachable.expectedApprox).toBeCloseTo(807.84, 8);
    expect(result.trace.filter((step) => step.fieldId === '__city__')).toHaveLength(1);
    expect(result.configChecksum).toBe(DEFAULT_CONFIG_CHECKSUM);
  });

  it('adds boosts from the same base and is independent of toggle order', () => {
    const base = { matchCityId: 'jp_tokyo', own: {}, requirements: {}, currencyInputs: {} };
    const left = defaultEngine.estimate({ ...base, reach: { tierId: 'daily', boostIds: ['friends', 'family'] } });
    const right = defaultEngine.estimate({ ...base, reach: { tierId: 'daily', boostIds: ['family', 'friends'] } });
    expect(left.effectiveReach).toBe(3_500);
    expect(right.effectiveReach).toBe(left.effectiveReach);
    expect(left.reachable.expectedApprox).toBe(3_500);
  });

  it('is monotonic across all five levels and keeps the predicate score until level zero', () => {
    const counts: number[] = [];
    const scores: Array<number | null> = [];
    for (const level of defaultRuntimeConfig.strictnessLevels) {
      const requirement: Requirement = {
        state: 'required', strictnessLevelId: level.id, predicate: { op: 'gte', value: 240_000 },
      };
      const result = defaultEngine.evaluate({
        matchCityId: 'jp_tokyo', reach: { tierId: 'daily', boostIds: [] }, own: {}, currencyInputs: {},
        requirements: { annual_income_cny: requirement },
      });
      counts.push(result.population.expectedApprox!);
      scores.push(result.scores.requirements.score);
    }
    expect(counts).toEqual([...counts].sort((left, right) => left - right));
    expect(scores.slice(0, 4)).toEqual([70, 70, 70, 70]);
    expect(scores[4]).toBeNull();
    expect(counts[4]).toBeCloseTo(11_200_000, 4);
  });
});

describe('relaxations', () => {
  it('moves exactly one field to its adjacent next level and never reduces either result', () => {
    const input: NormalizedInput = {
      matchCityId: 'jp_tokyo', reach: { tierId: 'daily', boostIds: [] }, own: {}, currencyInputs: {},
      requirements: {
        gender: { state: 'required', strictnessLevelId: 'must', predicate: { op: 'in', values: ['female'] } },
        education: { state: 'required', strictnessLevelId: 'must', predicate: { op: 'in', values: ['master', 'doctor'] } },
      },
    };
    const generated = new RelaxationGenerator().generate(input);
    expect(generated).toHaveLength(2);
    for (const relaxation of generated) {
      expect(relaxation.originalLevelId).toBe('must');
      expect(relaxation.proposedLevelId).toBe('prefer');
      expect(relaxation.after.log10Expected!).toBeGreaterThanOrEqual(relaxation.before.log10Expected!);
      expect(relaxation.reachableAfter.log10Expected!).toBeGreaterThanOrEqual(relaxation.reachableBefore.log10Expected!);
    }
  });
});

describe('display formatting', () => {
  it('does not expose scientific notation in human-scale counts', () => {
    expect(formatExpectedCount({ expectedApprox: 97_500_000, log10Expected: Math.log10(97_500_000), isMathematicalZero: false })).toBe('约 9,750 万人');
    expect(formatExpectedCount({ expectedApprox: 0.2, log10Expected: Math.log10(0.2), isMathematicalZero: false })).toBe('预计不足 1 人');
  });
});
