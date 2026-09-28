import catalogV1Json from '../../../config/catalog.demo.v1.json';
import modelV1Json from '../../../config/model.demo.v1.json';
import runtimeV2Json from '../../../config/runtime.demo.v2.json';
import {
  parseRuntimeConfigBundle,
  type CatalogConfig,
  type CatalogField,
  type ConfigValidationIssue,
  type FieldId,
  type ModelConfig,
  type ModelContext,
  type RuntimeConfigBundle,
} from '@tls/domain';

interface RuntimeSeed {
  schemaVersion: '2.0.0';
  configBundleVersion: string;
  catalogVersion: string;
  modelVersion: string;
  noticeVersion: string;
  defaultCityId: string;
  cityResidualMass: number;
  cities: RuntimeConfigBundle['cities'];
  reachTiers: RuntimeConfigBundle['reachTiers'];
  reachBoosts: RuntimeConfigBundle['reachBoosts'];
  strictnessLevels: RuntimeConfigBundle['strictnessLevels'];
}

const seed = runtimeV2Json as RuntimeSeed;
const legacyCatalog = catalogV1Json as Omit<CatalogConfig, 'fields'> & {
  fields: Array<Omit<CatalogField, 'status'>>;
};
const legacyModel = modelV1Json as ModelConfig;

const catalogV2: CatalogConfig = {
  schemaVersion: '2.0.0',
  catalogVersion: seed.catalogVersion,
  language: legacyCatalog.language,
  groups: legacyCatalog.groups,
  fields: legacyCatalog.fields
    .filter((field) => field.id !== 'residence')
    .map((field) => ({ ...field, status: 'active' as const })),
};

const modelFields = Object.fromEntries(
  Object.entries(legacyModel.fields).filter(([fieldId]) => fieldId !== 'residence'),
) as ModelConfig['fields'];

const modelV2: ModelConfig = {
  schemaVersion: '2.0.0',
  modelVersion: seed.modelVersion,
  catalogVersion: seed.catalogVersion,
  status: legacyModel.status,
  basePopulation: legacyModel.basePopulation,
  adultFraction: legacyModel.adultFraction,
  currency: legacyModel.currency,
  fields: modelFields,
};

export const defaultRuntimeConfig: RuntimeConfigBundle = parseRuntimeConfigBundle({
  schemaVersion: seed.schemaVersion,
  configBundleVersion: seed.configBundleVersion,
  noticeVersion: seed.noticeVersion,
  catalog: catalogV2,
  model: modelV2,
  cities: seed.cities,
  cityResidualMass: seed.cityResidualMass,
  defaultCityId: seed.defaultCityId,
  reachTiers: seed.reachTiers,
  reachBoosts: seed.reachBoosts,
  strictnessLevels: seed.strictnessLevels,
});

function closeToOne(value: number): boolean {
  return Math.abs(value - 1) <= 1e-6;
}

function closeTo(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
}

function push(issues: ConfigValidationIssue[], path: string, code: string, message: string): void {
  issues.push({ path, code, message });
}

export function validateRuntimeConfig(value: unknown): {
  bundle?: RuntimeConfigBundle;
  issues: ConfigValidationIssue[];
} {
  const parsed = (() => {
    try {
      return parseRuntimeConfigBundle(value);
    } catch (error) {
      const details = error instanceof Error ? error.message : '配置结构无效。';
      return { structuralError: details } as const;
    }
  })();
  if ('structuralError' in parsed) {
    return { issues: [{ path: '$', code: 'invalid_schema', message: parsed.structuralError }] };
  }

  const bundle = parsed;
  const issues: ConfigValidationIssue[] = [];
  if (bundle.catalog.catalogVersion !== bundle.model.catalogVersion) {
    push(issues, 'model.catalogVersion', 'version_mismatch', 'model 必须引用同一 catalogVersion。');
  }

  const groupIds = new Set(bundle.catalog.groups.map((group) => group.id));
  if (groupIds.size !== bundle.catalog.groups.length) {
    push(issues, 'catalog.groups', 'duplicate_id', '分组 ID 必须唯一。');
  }
  const fieldIds = new Set<string>();
  for (const [index, field] of bundle.catalog.fields.entries()) {
    const path = `catalog.fields[${index}]`;
    if (fieldIds.has(field.id)) push(issues, `${path}.id`, 'duplicate_id', `问题 ID ${field.id} 重复。`);
    fieldIds.add(field.id);
    if (!groupIds.has(field.group)) push(issues, `${path}.group`, 'unknown_group', `分组 ${field.group} 不存在。`);
    const supportedControls = field.kind === 'number'
      ? { self: new Set(['number_or_preset', 'number_input']), requirement: new Set(['preset_or_select_range', 'range_and_presets']) }
      : field.kind === 'tags'
        ? { self: new Set(['multi_choice']), requirement: new Set(['acceptable_multi_choice']) }
        : { self: new Set(['single_choice']), requirement: new Set(['acceptable_multi_choice']) };
    if (!supportedControls.self.has(field.selfControl) || !supportedControls.requirement.has(field.requirementControl)) {
      push(issues, path, 'unsupported_control', '问题只能使用该类型受支持的安全控件模板。');
    }
    const requiredOperators = field.kind === 'number' ? ['gte', 'lte', 'between'] : [field.kind === 'tags' ? 'any_of' : 'in'];
    const supportedOperators = new Set(field.kind === 'number' ? [...requiredOperators, 'relative'] : requiredOperators);
    if (requiredOperators.some((operator) => !field.allowedOperators.includes(operator)) || field.allowedOperators.some((operator) => !supportedOperators.has(operator))) {
      push(issues, `${path}.allowedOperators`, 'unsupported_operator', '运算符必须与问题模板匹配，不能注入自定义执行逻辑。');
    }
    const configured = bundle.model.fields[field.id];
    if (!configured) {
      push(issues, `model.fields.${field.id}`, 'missing_model', '每道问题都必须有分布和评分定义。');
      continue;
    }

    const allOptions = field.options ?? [];
    const activeOptions = allOptions.filter((option) => option.status !== 'retired');
    const allOptionIds = new Set(allOptions.map((option) => option.id));
    const activeOptionIds = new Set(activeOptions.map((option) => option.id));
    if (allOptionIds.size !== allOptions.length) {
      push(issues, `${path}.options`, 'duplicate_id', '同一道问题中的选项 ID 必须唯一。');
    }
    if (field.kind === 'number') {
      if (field.minimum === undefined || field.maximum === undefined || field.step === undefined || field.minimum > field.maximum) {
        push(issues, path, 'invalid_numeric_domain', '数值问题必须提供有效 minimum、maximum 和 step。');
      }
      if (configured.distribution.kind !== 'bucket_uniform_discrete') {
        push(issues, `model.fields.${field.id}.distribution`, 'distribution_kind', '数值问题必须使用数值桶分布。');
      } else {
        const sum = configured.distribution.buckets.reduce((total, bucket) => total + bucket.mass, 0);
        if (!closeToOne(sum)) push(issues, `model.fields.${field.id}.distribution`, 'mass_sum', `数值桶质量合计为 ${sum}，必须为 1。`);
        const sorted = [...configured.distribution.buckets].sort((left, right) => left.from - right.from);
        for (let bucketIndex = 0; bucketIndex < sorted.length; bucketIndex += 1) {
          const bucket = sorted[bucketIndex]!;
          if (bucket.from >= bucket.toExclusive) push(issues, `model.fields.${field.id}.distribution.buckets[${bucketIndex}]`, 'invalid_bucket', '桶起点必须小于终点。');
          if (bucketIndex > 0 && sorted[bucketIndex - 1]!.toExclusive !== bucket.from) {
            push(issues, `model.fields.${field.id}.distribution.buckets[${bucketIndex}]`, 'bucket_gap', '数值桶必须连续且不重叠。');
          }
        }
        if (
          field.minimum !== undefined && field.maximum !== undefined && field.step !== undefined &&
          (!closeTo(sorted[0]?.from ?? Number.NaN, field.minimum) ||
            !closeTo(sorted.at(-1)?.toExclusive ?? Number.NaN, field.maximum + field.step))
        ) {
          push(issues, `model.fields.${field.id}.distribution`, 'bucket_coverage', '数值桶必须从 minimum 连续覆盖到 maximum + step。');
        }
      }
    } else {
      if (!activeOptions.length) push(issues, `${path}.options`, 'missing_options', '枚举或标签问题至少需要一个 active 选项。');
      const expectedKind = field.kind === 'tags' ? 'independent_tags' : 'categorical';
      if (configured.distribution.kind !== expectedKind) {
        push(issues, `model.fields.${field.id}.distribution`, 'distribution_kind', `${field.kind} 问题必须使用 ${expectedKind} 分布。`);
      } else {
        for (const configuredOptionId of Object.keys(configured.distribution.mass)) {
          if (!allOptionIds.has(configuredOptionId)) push(issues, `model.fields.${field.id}.distribution.mass.${configuredOptionId}`, 'orphan_mass', '人口比例不能引用目录中不存在的选项。');
        }
        for (const optionId of activeOptionIds) {
          if (!(optionId in configured.distribution.mass)) push(issues, `model.fields.${field.id}.distribution.mass.${optionId}`, 'missing_mass', 'active 选项必须有比例。');
        }
        if (configured.distribution.kind === 'categorical') {
          const mass = configured.distribution.mass;
          const sum = [...activeOptionIds].reduce((total, optionId) => total + (mass[optionId] ?? 0), 0);
          if (!closeToOne(sum)) push(issues, `model.fields.${field.id}.distribution`, 'mass_sum', `互斥选项质量合计为 ${sum}，必须为 1。`);
        }
      }
    }

    const presetIds = field.presets.map((preset) => preset.id).filter((id): id is string => Boolean(id));
    if (new Set(presetIds).size !== presetIds.length) push(issues, `${path}.presets`, 'duplicate_id', '同一道问题中的预设 ID 必须唯一。');
    for (const [presetIndex, preset] of field.presets.entries()) {
      if (preset.status === 'retired') continue;
      const presetPath = `${path}.presets[${presetIndex}]`;
      if (field.kind === 'number') {
        const inRange = (number: number | undefined) => number !== undefined && number >= (field.minimum ?? Infinity) && number <= (field.maximum ?? -Infinity);
        if ((preset.op === 'gte' || preset.op === 'lte') && !inRange(preset.value)) {
          push(issues, presetPath, 'invalid_preset', '数值门槛预设必须提供范围内的 value。');
        } else if (preset.op === 'between' && (!inRange(preset.min) || !inRange(preset.max) || preset.min! > preset.max!)) {
          push(issues, presetPath, 'invalid_preset', '数值区间预设必须提供范围内且 min <= max 的端点。');
        } else if (!preset.op) {
          push(issues, presetPath, 'invalid_preset', '数值预设必须指定 gte、lte 或 between。');
        }
      } else {
        if (!preset.id || !preset.values?.length || preset.values.some((optionId) => !activeOptionIds.has(optionId))) {
          push(issues, presetPath, 'invalid_preset', '枚举/标签预设必须有 ID，并且只引用 active 选项。');
        }
      }
    }

    if (field.scoreEnabled && configured.score.kind === 'excluded') {
      push(issues, `model.fields.${field.id}.score`, 'missing_score', '启用评分的问题必须有评分定义。');
    }
    if (!field.scoreEnabled && configured.score.kind !== 'excluded') {
      push(issues, `model.fields.${field.id}.score`, 'unexpected_score', '未启用评分的问题不能保留生效中的评分定义。');
    }
    if (configured.score.kind === 'category_map') {
      if (field.kind !== 'enum') push(issues, `model.fields.${field.id}.score`, 'score_kind', '类别评分只支持互斥枚举问题。');
      for (const scoredOptionId of Object.keys(configured.score.values)) {
        if (!allOptionIds.has(scoredOptionId)) push(issues, `model.fields.${field.id}.score.values.${scoredOptionId}`, 'orphan_score', '评分不能引用目录中不存在的选项。');
      }
      for (const optionId of activeOptionIds) {
        if (!(optionId in configured.score.values)) push(issues, `model.fields.${field.id}.score.values.${optionId}`, 'missing_score_value', '可评分 active 选项必须有分值。');
      }
    } else if (configured.score.kind === 'piecewise_linear') {
      if (field.kind !== 'number') push(issues, `model.fields.${field.id}.score`, 'score_kind', '折线评分只支持数值问题。');
      for (let knotIndex = 0; knotIndex < configured.score.knots.length; knotIndex += 1) {
        const knot = configured.score.knots[knotIndex]!;
        if (knot.value < (field.minimum ?? Infinity) || knot.value > (field.maximum ?? -Infinity)) {
          push(issues, `model.fields.${field.id}.score.knots[${knotIndex}]`, 'score_knot_range', '评分折点必须位于问题数值范围内。');
        }
        if (knotIndex > 0 && configured.score.knots[knotIndex - 1]!.value >= knot.value) {
          push(issues, `model.fields.${field.id}.score.knots`, 'score_knot_order', '评分折点必须按 value 严格递增。');
          break;
        }
      }
    }
  }
  for (const fieldId of Object.keys(bundle.model.fields)) {
    if (!fieldIds.has(fieldId)) push(issues, `model.fields.${fieldId}`, 'orphan_model', '模型不能包含目录中不存在的问题。');
  }
  const fieldsById = new Map(bundle.catalog.fields.map((field) => [field.id, field]));
  for (const [fieldIndex, field] of bundle.catalog.fields.entries()) {
    const relativeIds = (field.relativePresets ?? []).map((preset) => preset.id).filter((id): id is string => Boolean(id));
    if (new Set(relativeIds).size !== relativeIds.length) {
      push(issues, `catalog.fields[${fieldIndex}].relativePresets`, 'duplicate_id', '同一道问题中的相对预设 ID 必须唯一。');
    }
    for (const [presetIndex, preset] of (field.relativePresets ?? []).entries()) {
      if (preset.status === 'retired') continue;
      const source = fieldsById.get(preset.sourceFieldId ?? field.id);
      const validBetween = preset.minOffset !== undefined && preset.maxOffset !== undefined && preset.minOffset <= preset.maxOffset;
      const validThreshold = (preset.operator === 'gte' || preset.operator === 'lte') && preset.offset !== undefined;
      if (
        field.kind !== 'number' || source?.kind !== 'number' ||
        (field.status === 'active' && source.status !== 'active') ||
        (!validBetween && !validThreshold)
      ) {
        push(issues, `catalog.fields[${fieldIndex}].relativePresets[${presetIndex}]`, 'invalid_relative_preset', '相对预设必须连接两个数值问题，并提供有效偏移或偏移区间。');
      }
    }
  }

  const cityIds = new Set<string>();
  for (const [index, city] of bundle.cities.entries()) {
    if (cityIds.has(city.id)) push(issues, `cities[${index}].id`, 'duplicate_id', '城市 ID 必须唯一。');
    cityIds.add(city.id);
  }
  const activeCities = bundle.cities.filter((city) => city.status === 'active');
  if (!activeCities.some((city) => city.id === bundle.defaultCityId)) {
    push(issues, 'defaultCityId', 'invalid_default', '默认城市必须是 active 真实城市。');
  }
  const cityMass = activeCities.reduce((total, city) => total + city.populationMass, bundle.cityResidualMass);
  if (!closeToOne(cityMass)) push(issues, 'cities', 'mass_sum', `城市质量加 residual 为 ${cityMass}，必须为 1。`);

  const activeTiers = bundle.reachTiers.filter((tier) => tier.status === 'active');
  if (activeTiers.filter((tier) => tier.isDefault).length !== 1) {
    push(issues, 'reachTiers', 'invalid_default', 'active 圈层必须恰好有一个默认项。');
  }
  if (new Set(bundle.reachTiers.map((tier) => tier.id)).size !== bundle.reachTiers.length) {
    push(issues, 'reachTiers', 'duplicate_id', '圈层 ID 必须唯一。');
  }
  if (new Set(bundle.reachBoosts.map((boost) => boost.id)).size !== bundle.reachBoosts.length) {
    push(issues, 'reachBoosts', 'duplicate_id', '助力 ID 必须唯一。');
  }

  const levels = [...bundle.strictnessLevels].sort((left, right) => right.coefficient - left.coefficient);
  if (new Set(levels.map((level) => level.id)).size !== levels.length) {
    push(issues, 'strictnessLevels', 'duplicate_id', '放宽档位 ID 必须唯一。');
  }
  if (levels[0]?.coefficient !== 1 || levels.at(-1)?.coefficient !== 0) {
    push(issues, 'strictnessLevels', 'invalid_endpoints', '五档端点必须为 1 和 0。');
  }
  if (levels.filter((level) => level.isDefault).length !== 1 || !levels.find((level) => level.isDefault && level.coefficient === 1)) {
    push(issues, 'strictnessLevels', 'invalid_default', '必须档 1.0 必须是唯一默认档。');
  }
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index - 1]!.coefficient <= levels[index]!.coefficient) {
      push(issues, 'strictnessLevels', 'not_strictly_descending', '五档系数必须严格递减。');
      break;
    }
  }

  return issues.length ? { bundle, issues } : { bundle, issues: [] };
}

export function assertRuntimeConfig(value: unknown): asserts value is RuntimeConfigBundle {
  const result = validateRuntimeConfig(value);
  if (result.issues.length) {
    throw new Error(result.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'));
  }
}

assertRuntimeConfig(defaultRuntimeConfig);

export function cloneRuntimeConfig(bundle: RuntimeConfigBundle = defaultRuntimeConfig): RuntimeConfigBundle {
  return structuredClone(bundle);
}

/** Canonical semantic form used by API and Excel checksums. */
export function normalizeRuntimeConfig(bundle: RuntimeConfigBundle): RuntimeConfigBundle {
  return {
    ...structuredClone(bundle),
    catalog: {
      ...structuredClone(bundle.catalog),
      fields: bundle.catalog.fields.map((field) => {
        const { relativePresets, ...withoutRelative } = structuredClone(field);
        return {
          ...withoutRelative,
          ...(field.options ? {
            options: field.options.map((option) => ({ ...option, status: option.status ?? 'active' })),
          } : {}),
          presets: field.presets.map((preset) => ({ ...preset, status: preset.status ?? 'active' })),
          ...(relativePresets?.length ? {
            relativePresets: relativePresets.map((preset) => ({
              ...preset,
              sourceFieldId: preset.sourceFieldId ?? field.id,
              status: preset.status ?? 'active',
            })),
          } : {}),
        };
      }),
    },
  };
}

export function contextFor(bundle: RuntimeConfigBundle): ModelContext {
  return {
    configBundleVersion: bundle.configBundleVersion,
    catalogVersion: bundle.catalog.catalogVersion,
    modelVersion: bundle.model.modelVersion,
    fxVersion: bundle.model.currency.rateVersion,
  };
}

export function indexesFor(bundle: RuntimeConfigBundle) {
  const fields = bundle.catalog.fields.filter((field) => field.status === 'active');
  return {
    fieldOrder: fields.map((field) => field.id),
    fieldsById: Object.fromEntries(bundle.catalog.fields.map((field) => [field.id, field])) as Record<FieldId, CatalogField>,
    citiesById: Object.fromEntries(bundle.cities.map((city) => [city.id, city])),
    reachTiersById: Object.fromEntries(bundle.reachTiers.map((tier) => [tier.id, tier])),
    reachBoostsById: Object.fromEntries(bundle.reachBoosts.map((boost) => [boost.id, boost])),
    strictnessById: Object.fromEntries(bundle.strictnessLevels.map((level) => [level.id, level])),
  };
}

export const catalog = defaultRuntimeConfig.catalog;
export const model = defaultRuntimeConfig.model;
export const { fieldOrder, fieldsById } = indexesFor(defaultRuntimeConfig);
export const modelContext = contextFor(defaultRuntimeConfig);
export const SUPPORTED_VERSIONS = {
  schemaVersion: '2.0.0' as const,
  configBundleVersion: defaultRuntimeConfig.configBundleVersion,
  catalogVersion: catalog.catalogVersion,
  modelVersion: model.modelVersion,
  fxVersion: model.currency.rateVersion,
  noticeVersion: defaultRuntimeConfig.noticeVersion,
};

/** SHA-256 of normalizeRuntimeConfig(defaultRuntimeConfig). Update only with a new seed bundle. */
export const DEFAULT_CONFIG_CHECKSUM = '46e5a69dd5162f71994b528768b4ef62a365d81678011254600b6e2d5be2c2ca';
