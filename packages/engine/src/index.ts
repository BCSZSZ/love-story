import {
  type AcceptanceEstimator,
  type CatalogField,
  type CurrencyInput,
  type ExpectedCount,
  type FieldId,
  type InputIssue,
  type ModelContext,
  type NormalizedInput,
  type OwnAnswer,
  type PopulationResult,
  type Predicate,
  type Relaxation,
  type Requirement,
  type RuntimeConfigBundle,
  type ScoreDefinition,
  type ScoreResult,
} from '@tls/domain';
import {
  catalog,
  contextFor,
  DEFAULT_CONFIG_CHECKSUM,
  defaultRuntimeConfig,
  fieldOrder,
  fieldsById,
  indexesFor,
  model,
  modelContext,
} from '@tls/model-config';

const MIN_LOG10_REPRESENTABLE = Math.log10(Number.MIN_VALUE);

interface ResolvedPredicate {
  predicate?: Exclude<Predicate, { op: 'relative' }>;
  issue?: InputIssue;
}

function issue(fieldId: InputIssue['fieldId'], code: InputIssue['code'], message: string): InputIssue {
  return { fieldId, code, message };
}

function expectedFromLog(log10Expected: number | null, isMathematicalZero: boolean): ExpectedCount {
  if (isMathematicalZero || log10Expected === null) {
    return { expectedApprox: 0, log10Expected: null, isMathematicalZero: true };
  }
  const expectedApprox = log10Expected < MIN_LOG10_REPRESENTABLE ? null : 10 ** log10Expected;
  return {
    expectedApprox: Number.isFinite(expectedApprox) ? expectedApprox : null,
    log10Expected,
    isMathematicalZero: false,
  };
}

function getAnsweredNumber(answer: OwnAnswer | undefined): number | undefined {
  return answer?.state === 'answered' && typeof answer.value === 'number' ? answer.value : undefined;
}

function formatValue(field: CatalogField, value: number): string {
  if (field.unit?.startsWith('CNY')) return `${new Intl.NumberFormat('zh-CN').format(value)}元`;
  return `${new Intl.NumberFormat('zh-CN').format(value)}${field.unit ?? ''}`;
}

export class RuntimeEngine {
  readonly context: ModelContext;
  readonly fieldOrder: FieldId[];
  readonly fieldsById: Record<FieldId, CatalogField>;
  readonly citiesById: ReturnType<typeof indexesFor>['citiesById'];
  readonly reachTiersById: ReturnType<typeof indexesFor>['reachTiersById'];
  readonly reachBoostsById: ReturnType<typeof indexesFor>['reachBoostsById'];
  readonly strictnessById: ReturnType<typeof indexesFor>['strictnessById'];

  constructor(readonly config: RuntimeConfigBundle, readonly configChecksum = 'unverified') {
    this.context = contextFor(config);
    const indexes = indexesFor(config);
    this.fieldOrder = indexes.fieldOrder;
    this.fieldsById = indexes.fieldsById;
    this.citiesById = indexes.citiesById;
    this.reachTiersById = indexes.reachTiersById;
    this.reachBoostsById = indexes.reachBoostsById;
    this.strictnessById = indexes.strictnessById;
  }

  versionsMatch(context: ModelContext): boolean {
    return (
      context.configBundleVersion === this.context.configBundleVersion &&
      context.catalogVersion === this.context.catalogVersion &&
      context.modelVersion === this.context.modelVersion &&
      context.fxVersion === this.context.fxVersion
    );
  }

  defaultStrictnessId(): string {
    return this.config.strictnessLevels.find((level) => level.isDefault)?.id ?? 'must';
  }

  noRequirementLevelId(): string {
    return this.config.strictnessLevels.find((level) => level.coefficient === 0)?.id ?? 'any';
  }

  strictnessFor(requirement: Requirement | undefined): number {
    if (!requirement || requirement.state === 'any') return 0;
    return this.strictnessById[requirement.strictnessLevelId]?.coefficient ?? 1;
  }

  isRequirementEnabled(requirement: Requirement | undefined): boolean {
    return requirement?.state === 'required' && this.strictnessFor(requirement) > 0;
  }

  expandOptionValues(fieldId: FieldId, values: readonly string[]): string[] {
    const field = this.fieldsById[fieldId];
    if (!field) return [];
    const valid = new Set((field.options ?? []).filter((option) => option.status !== 'retired').map((option) => option.id));
    const presets = new Map(
      field.presets
        .filter((preset) => preset.status !== 'retired' && preset.id && preset.values)
        .map((preset) => [preset.id as string, preset.values as string[]]),
    );
    const expanded = new Set<string>();
    for (const value of values) {
      const presetValues = presets.get(value);
      if (presetValues) {
        for (const presetValue of presetValues) if (valid.has(presetValue)) expanded.add(presetValue);
      } else if (valid.has(value)) {
        expanded.add(value);
      }
    }
    return [...expanded];
  }

  resolvePredicate(fieldId: FieldId, predicate: Predicate, own: NormalizedInput['own']): ResolvedPredicate {
    const field = this.fieldsById[fieldId];
    if (!field) return { issue: issue(fieldId, 'unknown_field', `未知问题 ${fieldId}。`) };
    if (predicate.op !== 'relative') return { predicate };
    const sourceField = this.fieldsById[predicate.sourceField];
    if (!sourceField || sourceField.kind !== 'number') {
      return { issue: issue(fieldId, 'invalid_value', '相对条件引用了不存在或不兼容的问题。') };
    }
    const source = getAnsweredNumber(own[predicate.sourceField]);
    if (source === undefined) {
      return { issue: issue(fieldId, 'missing_relative_source', `请先填写“${sourceField.label}”，此相对要求才会计入。`) };
    }
    const minimum = field.minimum ?? Number.NEGATIVE_INFINITY;
    const maximum = field.maximum ?? Number.POSITIVE_INFINITY;
    if (predicate.comparison === 'between') {
      const min = Math.max(minimum, source + predicate.minOffset);
      const max = Math.min(maximum, source + predicate.maxOffset);
      if (min > max) return { issue: issue(fieldId, 'invalid_range', '相对范围在当前字段边界内无有效取值。') };
      return { predicate: { op: 'between', min, max } };
    }
    const value = Math.min(maximum, Math.max(minimum, source + predicate.offset));
    return { predicate: { op: predicate.comparison, value } };
  }

  numericBounds(field: CatalogField, predicate: Exclude<Predicate, { op: 'relative' }>): [number, number] | undefined {
    if (field.minimum === undefined || field.maximum === undefined) return undefined;
    switch (predicate.op) {
      case 'gte': return [Math.max(field.minimum, predicate.value), field.maximum];
      case 'lte': return [field.minimum, Math.min(field.maximum, predicate.value)];
      case 'between': return [Math.max(field.minimum, predicate.min), Math.min(field.maximum, predicate.max)];
      default: return undefined;
    }
  }

  validateInput(input: NormalizedInput, context: ModelContext = this.context): InputIssue[] {
    const issues: InputIssue[] = [];
    if (!this.versionsMatch(context)) issues.push(issue('__config__', 'version_mismatch', '配置版本不匹配，不能使用未知版本计算。'));
    const city = this.citiesById[input.matchCityId];
    if (!city || city.status !== 'active') issues.push(issue('__city__', 'unknown_city', '请选择当前配置中的真实城市。'));
    const tier = this.reachTiersById[input.reach.tierId];
    if (!tier || tier.status !== 'active') issues.push(issue('__config__', 'unknown_reach', '可触达圈层不存在或已停用。'));
    if (new Set(input.reach.boostIds).size !== input.reach.boostIds.length) {
      issues.push(issue('__config__', 'unknown_reach', '助力项不能重复。'));
    }
    for (const boostId of input.reach.boostIds) {
      const boost = this.reachBoostsById[boostId];
      if (!boost || boost.status !== 'active') issues.push(issue('__config__', 'unknown_reach', `助力项 ${boostId} 不存在或已停用。`));
    }

    const allInputIds = new Set([...Object.keys(input.own), ...Object.keys(input.requirements), ...Object.keys(input.currencyInputs)]);
    for (const fieldId of allInputIds) {
      const field = this.fieldsById[fieldId];
      if (!field || field.status !== 'active') issues.push(issue(fieldId, 'unknown_field', `问题 ${fieldId} 不在当前配置中。`));
    }

    for (const fieldId of this.fieldOrder) {
      const field = this.fieldsById[fieldId]!;
      const validOptionTokens = new Set([
        ...(field.options ?? []).filter((option) => option.status !== 'retired').map((option) => option.id),
        ...field.presets.filter((preset) => preset.status !== 'retired' && preset.id && preset.values).map((preset) => preset.id as string),
      ]);
      const own = input.own[fieldId];
      if (own?.state === 'answered') {
        if (field.kind === 'number') {
          const step = field.step ?? 1;
          const offset = typeof own.value === 'number' ? (own.value - (field.minimum ?? 0)) / step : Number.NaN;
          if (
            typeof own.value !== 'number' || !Number.isFinite(own.value) ||
            own.value < (field.minimum ?? -Infinity) || own.value > (field.maximum ?? Infinity) ||
            Math.abs(offset - Math.round(offset)) > 1e-9
          ) issues.push(issue(fieldId, 'invalid_value', `${field.label}超出支持范围。`));
        } else if (field.kind === 'tags') {
          const expanded = Array.isArray(own.value) ? this.expandOptionValues(fieldId, own.value) : [];
          if (!Array.isArray(own.value) || own.value.some((value) => !validOptionTokens.has(value)) || expanded.length !== new Set(own.value).size) {
            issues.push(issue(fieldId, 'invalid_value', `${field.label}包含未知选项。`));
          }
        } else if (typeof own.value !== 'string' || !validOptionTokens.has(own.value) || !this.expandOptionValues(fieldId, [own.value]).length) {
          issues.push(issue(fieldId, 'invalid_value', `${field.label}包含未知选项。`));
        }
      }

      const currencyInput = input.currencyInputs[fieldId];
      if (currencyInput) {
        const expected = Math.round(currencyInput.originalValue * this.config.model.currency.demoCnyPerUnit[currencyInput.currency]);
        if (
          !field.unit?.startsWith('CNY') || currencyInput.fxVersion !== this.config.model.currency.rateVersion ||
          currencyInput.normalizedCny !== expected || own?.state !== 'answered' || own.value !== expected
        ) issues.push(issue(fieldId, 'invalid_value', `${field.label}的币种换算信息不一致。`));
      }

      const requirement = input.requirements[fieldId];
      if (!requirement || requirement.state === 'any' || this.strictnessFor(requirement) === 0) continue;
      if (!this.strictnessById[requirement.strictnessLevelId]) {
        issues.push(issue(fieldId, 'invalid_value', `${field.label}使用了未知放宽档位。`));
        continue;
      }
      const resolved = this.resolvePredicate(fieldId, requirement.predicate, input.own);
      if (resolved.issue) {
        issues.push(resolved.issue);
        continue;
      }
      const predicate = resolved.predicate;
      if (!predicate) continue;
      if (field.kind === 'number') {
        const bounds = this.numericBounds(field, predicate);
        if (!bounds || bounds[0] > bounds[1]) issues.push(issue(fieldId, 'invalid_range', `${field.label}的范围无有效取值。`));
      } else if (predicate.op !== 'in' && predicate.op !== 'any_of') {
        issues.push(issue(fieldId, 'invalid_value', `${field.label}使用了不支持的条件。`));
      } else if (predicate.values.some((value) => !validOptionTokens.has(value)) || !this.expandOptionValues(fieldId, predicate.values).length) {
        issues.push(issue(fieldId, 'invalid_value', `${field.label}没有有效选项。`));
      }
    }
    return issues;
  }

  probabilityForPredicate(fieldId: FieldId, predicate: Exclude<Predicate, { op: 'relative' }>): number {
    const field = this.fieldsById[fieldId];
    const configured = this.config.model.fields[fieldId];
    if (!field || !configured) return 0;
    const distribution = configured.distribution;
    if (distribution.kind === 'bucket_uniform_discrete') {
      const bounds = this.numericBounds(field, predicate);
      if (!bounds || bounds[0] > bounds[1]) return 0;
      const [allowedMin, allowedMax] = bounds;
      const step = field.step ?? 1;
      let probability = 0;
      for (const bucket of distribution.buckets) {
        const total = Math.max(0, Math.ceil((bucket.toExclusive - bucket.from) / step));
        if (!total) continue;
        const firstIndex = Math.max(0, Math.ceil((allowedMin - bucket.from) / step));
        const lastIndex = Math.min(total - 1, Math.floor((allowedMax - bucket.from) / step));
        probability += bucket.mass * (Math.max(0, lastIndex - firstIndex + 1) / total);
      }
      return Math.min(1, Math.max(0, probability));
    }
    if (predicate.op !== 'in' && predicate.op !== 'any_of') return 0;
    const values = this.expandOptionValues(fieldId, predicate.values);
    if (distribution.kind === 'independent_tags') {
      return 1 - values.reduce((product, value) => product * (1 - (distribution.mass[value] ?? 0)), 1);
    }
    return Math.min(1, values.reduce((total, value) => total + (distribution.mass[value] ?? 0), 0));
  }

  estimate(input: NormalizedInput, context: ModelContext = this.context): PopulationResult {
    const inputIssues = this.validateInput(input, context);
    let currentLog = Math.log10(this.config.model.basePopulation);
    let zero = false;
    const trace: PopulationResult['trace'] = [];
    const beforeAdult = expectedFromLog(currentLog, false);
    currentLog += Math.log10(this.config.model.adultFraction);
    trace.push({
      fieldId: '__adult__', rawCoefficient: this.config.model.adultFraction, strictness: 1,
      effectiveCoefficient: this.config.model.adultFraction, before: beforeAdult, after: expectedFromLog(currentLog, false),
    });

    const city = this.citiesById[input.matchCityId];
    const cityMass = city?.status === 'active' ? city.populationMass : 0;
    const beforeCity = expectedFromLog(currentLog, false);
    if (cityMass === 0) zero = true;
    else currentLog += Math.log10(cityMass);
    const cityAdultBase = expectedFromLog(zero ? null : currentLog, zero);
    trace.push({
      fieldId: '__city__', rawCoefficient: cityMass, strictness: 1, effectiveCoefficient: cityMass,
      before: beforeCity, after: cityAdultBase,
    });

    let log10ConditionCoverage = 0;
    for (const fieldId of this.fieldOrder) {
      const requirement = input.requirements[fieldId];
      if (!requirement || requirement.state === 'any') continue;
      const strictness = this.strictnessFor(requirement);
      if (strictness === 0) continue;
      const resolved = this.resolvePredicate(fieldId, requirement.predicate, input.own);
      if (resolved.issue || !resolved.predicate || inputIssues.some((entry) => entry.fieldId === fieldId)) continue;
      const rawCoefficient = this.probabilityForPredicate(fieldId, resolved.predicate);
      const effectiveCoefficient = 1 - strictness * (1 - rawCoefficient);
      const before = expectedFromLog(zero ? null : currentLog, zero);
      if (effectiveCoefficient === 0) zero = true;
      else {
        log10ConditionCoverage += Math.log10(effectiveCoefficient);
        if (!zero) currentLog += Math.log10(effectiveCoefficient);
      }
      trace.push({ fieldId, rawCoefficient, strictness, effectiveCoefficient, before, after: expectedFromLog(zero ? null : currentLog, zero) });
    }

    const tier = this.reachTiersById[input.reach.tierId];
    const baseReach = tier?.status === 'active' ? tier.people : 0;
    const boostRate = [...new Set(input.reach.boostIds)].reduce((total, boostId) => {
      const boost = this.reachBoostsById[boostId];
      return total + (boost?.status === 'active' ? boost.incrementRate : 0);
    }, 0);
    const cityApprox = cityAdultBase.expectedApprox ?? Number.POSITIVE_INFINITY;
    const effectiveReach = Math.max(0, Math.min(cityApprox, baseReach * (1 + boostRate)));
    const reachableZero = zero || effectiveReach === 0;
    const reachableLog = reachableZero ? null : Math.log10(effectiveReach) + log10ConditionCoverage;
    const conditionCoverage = zero
      ? 0
      : log10ConditionCoverage < MIN_LOG10_REPRESENTABLE
        ? null
        : 10 ** log10ConditionCoverage;
    const reachable = expectedFromLog(reachableLog, reachableZero);
    if (!reachableZero && conditionCoverage !== null) {
      const directApproximation = effectiveReach * conditionCoverage;
      if (Number.isFinite(directApproximation)) reachable.expectedApprox = directApproximation;
    }

    return {
      ...expectedFromLog(zero ? null : currentLog, zero),
      cityAdultBase,
      conditionCoverage,
      log10ConditionCoverage: zero ? null : log10ConditionCoverage,
      baseReach,
      effectiveReach,
      reachable,
      partial: inputIssues.length > 0,
      issues: inputIssues,
      trace,
      configBundleVersion: this.config.configBundleVersion,
      configChecksum: this.configChecksum,
      modelVersion: this.config.model.modelVersion,
      dataStatus: this.config.model.status,
    };
  }

  evaluateScoreDefinition(definition: ScoreDefinition, value: string | number): number | undefined {
    if (definition.kind === 'excluded') return undefined;
    if (definition.kind === 'category_map') return typeof value === 'string' ? definition.values[value] : undefined;
    if (typeof value !== 'number') return undefined;
    const first = definition.knots[0];
    const last = definition.knots.at(-1);
    if (!first || !last) return undefined;
    if (value <= first.value) return first.score;
    for (let index = 0; index < definition.knots.length - 1; index += 1) {
      const left = definition.knots[index]!;
      const right = definition.knots[index + 1]!;
      if (value > right.value) continue;
      return left.score + ((value - left.value) / (right.value - left.value)) * (right.score - left.score);
    }
    return last.score;
  }

  projectRequirementScore(fieldId: FieldId, predicate: Exclude<Predicate, { op: 'relative' }>): number | undefined {
    const definition = this.config.model.fields[fieldId]?.score;
    const field = this.fieldsById[fieldId];
    if (!definition || !field || definition.kind === 'excluded') return undefined;
    if (definition.kind === 'category_map') {
      if (predicate.op !== 'in' && predicate.op !== 'any_of') return undefined;
      const scores = this.expandOptionValues(fieldId, predicate.values)
        .map((value) => this.evaluateScoreDefinition(definition, value))
        .filter((value): value is number => value !== undefined);
      return scores.length ? Math.min(...scores) : undefined;
    }
    const bounds = this.numericBounds(field, predicate);
    if (!bounds) return undefined;
    const candidates = [bounds[0], bounds[1], ...definition.knots.filter((knot) => knot.value >= bounds[0] && knot.value <= bounds[1]).map((knot) => knot.value)];
    const scores = candidates.map((value) => this.evaluateScoreDefinition(definition, value)).filter((value): value is number => value !== undefined);
    return scores.length ? Math.min(...scores) : undefined;
  }

  aggregateScores(contributions: ScoreResult['contributions']): ScoreResult {
    const totalScorableCount = this.fieldOrder.filter((fieldId) => (this.config.model.fields[fieldId]?.score.weight ?? 0) > 0).length;
    const weightSum = contributions.reduce((total, contribution) => total + contribution.weight, 0);
    return {
      score: weightSum === 0 ? null : contributions.reduce((total, contribution) => total + contribution.score * contribution.weight, 0) / weightSum,
      presentScorableCount: contributions.length,
      totalScorableCount,
      weightSum,
      contributions,
    };
  }

  scoreOwn(input: NormalizedInput, context: ModelContext = this.context): ScoreResult {
    if (!this.versionsMatch(context)) return this.aggregateScores([]);
    const contributions: ScoreResult['contributions'] = [];
    for (const fieldId of this.fieldOrder) {
      const definition = this.config.model.fields[fieldId]?.score;
      const answer = input.own[fieldId];
      if (!definition || definition.weight <= 0 || answer?.state !== 'answered' || Array.isArray(answer.value)) continue;
      const score = this.evaluateScoreDefinition(definition, answer.value);
      if (score !== undefined) contributions.push({ fieldId, score, weight: definition.weight });
    }
    return this.aggregateScores(contributions);
  }

  scoreRequirements(input: NormalizedInput, context: ModelContext = this.context): ScoreResult {
    if (!this.versionsMatch(context)) return this.aggregateScores([]);
    const contributions: ScoreResult['contributions'] = [];
    for (const fieldId of this.fieldOrder) {
      const definition = this.config.model.fields[fieldId]?.score;
      const requirement = input.requirements[fieldId];
      if (!definition || definition.weight <= 0 || requirement?.state !== 'required' || this.strictnessFor(requirement) === 0) continue;
      const resolved = this.resolvePredicate(fieldId, requirement.predicate, input.own);
      if (!resolved.predicate || resolved.issue) continue;
      const score = this.projectRequirementScore(fieldId, resolved.predicate);
      if (score !== undefined) contributions.push({ fieldId, score, weight: definition.weight });
    }
    return this.aggregateScores(contributions);
  }

  evaluate(input: NormalizedInput, context: ModelContext = this.context) {
    return {
      population: this.estimate(input, context),
      scores: { own: this.scoreOwn(input, context), requirements: this.scoreRequirements(input, context) },
      acceptance: acceptanceEstimator.estimate(input, context),
    };
  }

  describePredicate(fieldId: FieldId, predicate: Predicate): string {
    const field = this.fieldsById[fieldId];
    if (!field) return '未知条件';
    if (predicate.op === 'relative') {
      const source = this.fieldsById[predicate.sourceField]?.label ?? predicate.sourceField;
      if (predicate.comparison === 'between') {
        return `相对${source} ${predicate.minOffset >= 0 ? '+' : ''}${predicate.minOffset}～${predicate.maxOffset >= 0 ? '+' : ''}${predicate.maxOffset}`;
      }
      return `${predicate.comparison === 'gte' ? '不低于' : '不高于'}我的${source}${predicate.offset ? ` ${predicate.offset > 0 ? '+' : ''}${predicate.offset}` : ''}`;
    }
    if (predicate.op === 'in' || predicate.op === 'any_of') {
      const labels = new Map((field.options ?? []).map((option) => [option.id, option.label]));
      return this.expandOptionValues(fieldId, predicate.values).map((value) => labels.get(value) ?? value).join('、');
    }
    if (predicate.op === 'between') return `${formatValue(field, predicate.min)}～${formatValue(field, predicate.max)}`;
    return `${predicate.op === 'gte' ? '至少' : '至多'}${formatValue(field, predicate.value)}`;
  }

  describeRequirement(fieldId: FieldId, requirement: Requirement): string {
    if (requirement.state === 'any' || this.strictnessFor(requirement) === 0 || !requirement.predicate) return '无要求';
    return this.describePredicate(fieldId, requirement.predicate);
  }

  normalizeCurrency(originalValue: number, currency: 'CNY' | 'JPY'): CurrencyInput {
    return {
      originalValue,
      currency,
      normalizedCny: Math.round(originalValue * this.config.model.currency.demoCnyPerUnit[currency]),
      fxVersion: this.config.model.currency.rateVersion,
    };
  }

  generateRelaxations(input: NormalizedInput, context: ModelContext = this.context): Relaxation[] {
    const before = this.estimate(input, context);
    const levels = [...this.config.strictnessLevels].sort((left, right) => right.coefficient - left.coefficient);
    const suggestions: Relaxation[] = [];
    for (const fieldId of this.fieldOrder) {
      const original = input.requirements[fieldId];
      if (original?.state !== 'required') continue;
      const currentIndex = levels.findIndex((level) => level.id === original.strictnessLevelId);
      const proposedLevel = levels[currentIndex + 1];
      if (currentIndex < 0 || !proposedLevel) continue;
      const proposed: Requirement = { ...original, strictnessLevelId: proposedLevel.id };
      const after = this.estimate({ ...input, requirements: { ...input.requirements, [fieldId]: proposed } }, context);
      suggestions.push({
        fieldId,
        originalLevelId: original.strictnessLevelId,
        proposedLevelId: proposedLevel.id,
        label: `${this.fieldsById[fieldId]?.label ?? fieldId}：${levels[currentIndex]!.label} → ${proposedLevel.label}`,
        before,
        after,
        reachableBefore: before.reachable,
        reachableAfter: after.reachable,
      });
    }
    return suggestions.sort((left, right) => {
      const leftGain = (left.after.log10Expected ?? -Infinity) - (left.before.log10Expected ?? -Infinity);
      const rightGain = (right.after.log10Expected ?? -Infinity) - (right.before.log10Expected ?? -Infinity);
      return rightGain - leftGain;
    });
  }
}

export function createRuntimeEngine(config: RuntimeConfigBundle, checksum = 'unverified'): RuntimeEngine {
  return new RuntimeEngine(config, checksum);
}

export const defaultEngine = createRuntimeEngine(defaultRuntimeConfig, DEFAULT_CONFIG_CHECKSUM);

export class IndependentPopulationEstimator {
  constructor(private readonly engine = defaultEngine) {}
  estimate(input: NormalizedInput, context: ModelContext = this.engine.context): PopulationResult {
    return this.engine.estimate(input, context);
  }
}

export class ConfiguredUnifiedScoreModel {
  constructor(private readonly engine = defaultEngine) {}
  scoreOwn(input: NormalizedInput, context: ModelContext = this.engine.context): ScoreResult {
    return this.engine.scoreOwn(input, context);
  }
  scoreRequirements(input: NormalizedInput, context: ModelContext = this.engine.context): ScoreResult {
    return this.engine.scoreRequirements(input, context);
  }
}

export class RelaxationGenerator {
  constructor(private readonly engine = defaultEngine) {}
  generate(input: NormalizedInput, context: ModelContext = this.engine.context): Relaxation[] {
    return this.engine.generateRelaxations(input, context);
  }
}

export const acceptanceEstimator: AcceptanceEstimator = { estimate: () => ({ status: 'not_implemented' }) };
export const populationEstimator = new IndependentPopulationEstimator();
export const scoreModel = new ConfiguredUnifiedScoreModel();

export const evaluate = (input: NormalizedInput, context: ModelContext = defaultEngine.context) => defaultEngine.evaluate(input, context);
export const validateInput = (input: NormalizedInput, context: ModelContext = defaultEngine.context) => defaultEngine.validateInput(input, context);
export const expandOptionValues = (fieldId: FieldId, values: readonly string[]) => defaultEngine.expandOptionValues(fieldId, values);
export const resolvePredicate = (fieldId: FieldId, predicate: Predicate, own: NormalizedInput['own']) => defaultEngine.resolvePredicate(fieldId, predicate, own);
export const probabilityForPredicate = (fieldId: FieldId, predicate: Exclude<Predicate, { op: 'relative' }>) => defaultEngine.probabilityForPredicate(fieldId, predicate);
export const describePredicate = (fieldId: FieldId, predicate: Predicate) => defaultEngine.describePredicate(fieldId, predicate);
export const describeRequirement = (fieldId: FieldId, requirement: Requirement) => defaultEngine.describeRequirement(fieldId, requirement);
export const normalizeCurrency = (originalValue: number, currency: 'CNY' | 'JPY') => defaultEngine.normalizeCurrency(originalValue, currency);

export function formatExpectedCount(expected: ExpectedCount): string {
  if (expected.isMathematicalZero) return '本模型下为 0';
  if (expected.expectedApprox === null || expected.expectedApprox < 1) return '预计不足 1 人';
  const concise = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 3 });
  if (expected.expectedApprox >= 100_000_000) return `约 ${concise.format(expected.expectedApprox / 100_000_000)} 亿人`;
  if (expected.expectedApprox >= 10_000) return `约 ${concise.format(expected.expectedApprox / 10_000)} 万人`;
  return `约 ${concise.format(expected.expectedApprox)} 人`;
}

export function formatExactExpected(expected: ExpectedCount): string {
  if (expected.isMathematicalZero) return '0';
  if (expected.expectedApprox !== null) return expected.expectedApprox.toLocaleString('zh-CN', { maximumFractionDigits: 6 });
  return expected.log10Expected === null ? '0' : `10^${expected.log10Expected.toFixed(3)}`;
}

export function rarityLabel(probability: number): '普通' | '较少' | '稀少' | '极少' {
  if (probability >= 0.2) return '普通';
  if (probability >= 0.05) return '较少';
  if (probability >= 0.01) return '稀少';
  return '极少';
}

export { catalog, fieldsById, fieldOrder, model, modelContext, defaultRuntimeConfig };
