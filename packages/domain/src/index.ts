import { z } from 'zod';

/** Initial v2 question ids. Runtime catalogs may add more ids without a code release. */
export const SEED_FIELD_IDS = [
  'gender', 'age', 'nationality', 'hukou', 'marital_status', 'relationship_count', 'cohabitation',
  'height_cm', 'weight_kg', 'appearance', 'university_tier', 'education', 'home', 'car',
  'other_assets_cny', 'debt_cny', 'occupation', 'annual_income_cny', 'job_stability', 'career_plan',
  'risk_buffer', 'financial_assets_cny', 'sociability', 'routine', 'social_frequency', 'hobbies',
  'smoking', 'drinking', 'gambling', 'drug_use', 'parents_pension_cny', 'father_age',
  'father_education', 'father_occupation', 'father_marital', 'mother_age', 'mother_education',
  'mother_occupation', 'mother_marital', 'only_child', 'family_net_assets_cny', 'live_with_parents',
  'parent_involvement', 'family_support', 'hereditary_history', 'spending_style', 'household_roles',
  'work_family_priority', 'emotion_regulation', 'conflict_style', 'credit_status', 'debt_disclosure',
  'children_plan', 'children_number', 'parenting_arrangement', 'health_status', 'cleanliness', 'diet',
  'pets', 'zodiac_sign', 'chinese_zodiac', 'mbti',
] as const;

/** @deprecated Runtime configuration is authoritative; retained for compatibility tooling. */
export const FIELD_IDS = SEED_FIELD_IDS;
export type FieldId = string;
export type Scalar = number | string;
export type StrictnessLevelId = string;

export type OwnAnswer =
  | { state: 'answered'; value: Scalar | string[] }
  | { state: 'skipped' };

export type Predicate =
  | { op: 'in'; values: string[] }
  | { op: 'any_of'; values: string[] }
  | { op: 'gte' | 'lte'; value: number }
  | { op: 'between'; min: number; max: number }
  | { op: 'relative'; sourceField: FieldId; comparison: 'gte' | 'lte'; offset: number }
  | { op: 'relative'; sourceField: FieldId; comparison: 'between'; minOffset: number; maxOffset: number };

export type Requirement =
  | { state: 'any'; predicate?: Predicate; strictnessLevelId?: StrictnessLevelId }
  | { state: 'required'; predicate: Predicate; strictnessLevelId: StrictnessLevelId };

export interface CurrencyInput {
  originalValue: number;
  currency: 'CNY' | 'JPY';
  normalizedCny: number;
  fxVersion: string;
}

export interface ReachSelection {
  tierId: string;
  boostIds: string[];
}

export interface InputIssue {
  fieldId: FieldId | '__city__' | '__config__';
  code:
    | 'missing_relative_source'
    | 'invalid_range'
    | 'invalid_value'
    | 'version_mismatch'
    | 'unknown_field'
    | 'unknown_city'
    | 'unknown_reach';
  message: string;
}

export interface NormalizedInput {
  matchCityId: string;
  reach: ReachSelection;
  own: Partial<Record<FieldId, OwnAnswer>>;
  requirements: Partial<Record<FieldId, Requirement>>;
  currencyInputs: Partial<Record<FieldId, CurrencyInput>>;
}

export interface ModelContext {
  configBundleVersion: string;
  catalogVersion: string;
  modelVersion: string;
  fxVersion: string;
}

export interface ExpectedCount {
  expectedApprox: number | null;
  log10Expected: number | null;
  isMathematicalZero: boolean;
}

export interface PopulationTraceStep {
  fieldId: FieldId | '__adult__' | '__city__';
  rawCoefficient: number;
  strictness: number;
  effectiveCoefficient: number;
  before: ExpectedCount;
  after: ExpectedCount;
}

export interface PopulationResult extends ExpectedCount {
  cityAdultBase: ExpectedCount;
  conditionCoverage: number | null;
  log10ConditionCoverage: number | null;
  baseReach: number;
  effectiveReach: number;
  reachable: ExpectedCount;
  partial: boolean;
  issues: InputIssue[];
  trace: PopulationTraceStep[];
  configBundleVersion: string;
  configChecksum: string;
  modelVersion: string;
  dataStatus: 'synthetic-demo' | 'researched';
}

export interface ScoreResult {
  score: number | null;
  presentScorableCount: number;
  totalScorableCount: number;
  weightSum: number;
  contributions: Array<{ fieldId: FieldId; score: number; weight: number }>;
}

export interface Relaxation {
  fieldId: FieldId;
  originalLevelId: StrictnessLevelId;
  proposedLevelId: StrictnessLevelId;
  label: string;
  before: ExpectedCount;
  after: ExpectedCount;
  reachableBefore: ExpectedCount;
  reachableAfter: ExpectedCount;
}

export interface SnapshotInput extends NormalizedInput, ModelContext {
  schemaVersion: '2.0.0';
  configChecksum: string;
  state: 'draft' | 'completed';
  noticeVersion: string;
}

export interface SaveRequest extends SnapshotInput {
  recordId: string;
  revision: number;
}

export interface SnapshotComputed extends SnapshotInput {
  result: PopulationResult;
  scores: { own: ScoreResult; requirements: ScoreResult };
}

export interface SaveAck {
  recordId: string;
  acceptedRevision: number;
  savedAt: string;
  expiresAt: number;
  computedSummary: {
    cityCandidatePool: ExpectedCount;
    reachableCandidateCount: ExpectedCount;
    ownScore: number | null;
    requirementsScore: number | null;
  };
}

export interface AcceptanceEstimator {
  estimate(input: NormalizedInput, context: ModelContext):
    | { status: 'not_implemented' }
    | { status: 'estimated'; acceptanceModelVersion: string; mutualExpected: number | null; notes: string[] };
}

export interface PublicRecordStore {
  create(input: SaveRequest, managementToken: string): Promise<SaveAck>;
  replace(input: SaveRequest, managementToken: string): Promise<SaveAck>;
  delete(recordId: string, managementToken: string): Promise<void>;
}

export interface CatalogOption {
  id: string;
  label: string;
  status?: 'active' | 'retired';
}

export interface CatalogPreset {
  id?: string;
  label: string;
  values?: string[];
  op?: 'gte' | 'lte' | 'between';
  value?: number;
  min?: number;
  max?: number;
  status?: 'active' | 'retired';
}

export interface RelativePreset {
  id?: string;
  label: string;
  sourceFieldId?: FieldId;
  operator?: 'gte' | 'lte';
  offset?: number;
  minOffset?: number;
  maxOffset?: number;
  status?: 'active' | 'retired';
}

export interface CatalogField {
  id: FieldId;
  label: string;
  group: string;
  kind: 'enum' | 'number' | 'tags';
  status: 'active' | 'retired';
  selfControl: string;
  requirementControl: string;
  allowedOperators: string[];
  requiredSelf: boolean;
  sensitive: boolean;
  sourceItem: string;
  note: string;
  scoreEnabled: boolean;
  options?: CatalogOption[];
  presets: CatalogPreset[];
  relativePresets?: RelativePreset[];
  unit?: string;
  minimum?: number;
  maximum?: number;
  step?: number;
}

export interface CatalogConfig {
  schemaVersion: string;
  catalogVersion: string;
  language: string;
  groups: Array<{ id: string; label: string }>;
  fields: CatalogField[];
}

export type Distribution =
  | { kind: 'categorical'; mass: Record<string, number> }
  | { kind: 'independent_tags'; mass: Record<string, number> }
  | { kind: 'bucket_uniform_discrete'; buckets: Array<{ from: number; toExclusive: number; mass: number }> };

export type ScoreDefinition =
  | { kind: 'excluded'; weight: 0 }
  | { kind: 'category_map'; weight: number; values: Record<string, number> }
  | { kind: 'piecewise_linear'; weight: number; knots: Array<{ value: number; score: number }> };

export interface ModelConfig {
  schemaVersion: string;
  modelVersion: string;
  catalogVersion: string;
  status: 'synthetic-demo' | 'researched';
  basePopulation: number;
  adultFraction: number;
  currency: {
    base: 'CNY';
    demoCnyPerUnit: Record<'CNY' | 'JPY', number>;
    status: string;
    rateVersion: string;
  };
  fields: Record<FieldId, { distribution: Distribution; score: ScoreDefinition }>;
}

export interface MatchCity {
  id: string;
  label: string;
  titleLabel: string;
  status: 'active' | 'retired';
  populationMass: number;
}

export interface ReachTier {
  id: string;
  label: string;
  people: number;
  status: 'active' | 'retired';
  isDefault: boolean;
}

export interface ReachBoost {
  id: string;
  label: string;
  incrementRate: number;
  status: 'active' | 'retired';
}

export interface StrictnessLevel {
  id: StrictnessLevelId;
  label: string;
  coefficient: number;
  isDefault: boolean;
}

export interface RuntimeConfigBundle {
  schemaVersion: '2.0.0';
  configBundleVersion: string;
  noticeVersion: string;
  catalog: CatalogConfig;
  model: ModelConfig;
  cities: MatchCity[];
  cityResidualMass: number;
  defaultCityId: string;
  reachTiers: ReachTier[];
  reachBoosts: ReachBoost[];
  strictnessLevels: StrictnessLevel[];
}

export interface ConfigValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ConfigVersionMetadata {
  configBundleVersion: string;
  revision: number;
  status: 'draft' | 'published';
  checksum: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  publishedAt?: string;
}

export interface PublishedConfigDefinitions {
  fields: Record<string, { kind: CatalogField['kind']; optionIds: string[] }>;
  cityIds: string[];
  reachTierIds: string[];
  reachBoostIds: string[];
}

const idPattern = /^[a-z][a-z0-9_]{1,63}$/;
export const fieldIdSchema = z.string().regex(idPattern);
const optionIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
const versionSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/);
const statusSchema = z.enum(['active', 'retired']);

const ownAnswerSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('skipped') }).strict(),
  z.object({
    state: z.literal('answered'),
    value: z.union([z.string(), z.number().finite(), z.array(z.string()).max(128)]),
  }).strict(),
]);

export const predicateSchema: z.ZodType<Predicate> = z.union([
  z.object({ op: z.literal('in'), values: z.array(z.string()).min(1).max(256) }).strict(),
  z.object({ op: z.literal('any_of'), values: z.array(z.string()).min(1).max(256) }).strict(),
  z.object({ op: z.enum(['gte', 'lte']), value: z.number().finite() }).strict(),
  z.object({ op: z.literal('between'), min: z.number().finite(), max: z.number().finite() }).strict(),
  z.object({
    op: z.literal('relative'), sourceField: fieldIdSchema, comparison: z.enum(['gte', 'lte']), offset: z.number().finite(),
  }).strict(),
  z.object({
    op: z.literal('relative'), sourceField: fieldIdSchema, comparison: z.literal('between'),
    minOffset: z.number().finite(), maxOffset: z.number().finite(),
  }).strict(),
]);

const requirementSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('any'), predicate: predicateSchema.optional(), strictnessLevelId: fieldIdSchema.optional() }).strict(),
  z.object({ state: z.literal('required'), predicate: predicateSchema, strictnessLevelId: fieldIdSchema }).strict(),
]);

const currencyInputSchema = z.object({
  originalValue: z.number().finite(), currency: z.enum(['CNY', 'JPY']), normalizedCny: z.number().finite(), fxVersion: versionSchema,
}).strict();

const fieldRecord = <T extends z.ZodType>(value: T) => z.record(fieldIdSchema, value);

export const saveRequestSchema = z.object({
  recordId: z.uuid(), revision: z.number().int().positive(), schemaVersion: z.literal('2.0.0'),
  state: z.enum(['draft', 'completed']), noticeVersion: versionSchema, configBundleVersion: versionSchema,
  configChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  catalogVersion: versionSchema, modelVersion: versionSchema, fxVersion: versionSchema, matchCityId: fieldIdSchema,
  reach: z.object({ tierId: fieldIdSchema, boostIds: z.array(fieldIdSchema).max(32) }).strict(),
  own: fieldRecord(ownAnswerSchema), requirements: fieldRecord(requirementSchema), currencyInputs: fieldRecord(currencyInputSchema),
}).strict();

const optionSchema = z.object({ id: optionIdSchema, label: z.string().min(1).max(120), status: statusSchema.optional() }).strict();
const presetSchema = z.object({
  id: optionIdSchema.optional(), label: z.string().min(1).max(120), values: z.array(optionIdSchema).optional(),
  op: z.enum(['gte', 'lte', 'between']).optional(), value: z.number().finite().optional(), min: z.number().finite().optional(),
  max: z.number().finite().optional(), status: statusSchema.optional(),
}).strict();
const relativePresetSchema = z.object({
  id: fieldIdSchema.optional(), label: z.string().min(1).max(120), sourceFieldId: fieldIdSchema.optional(),
  operator: z.enum(['gte', 'lte']).optional(), offset: z.number().finite().optional(), minOffset: z.number().finite().optional(),
  maxOffset: z.number().finite().optional(), status: statusSchema.optional(),
}).strict();
const catalogFieldSchema = z.object({
  id: fieldIdSchema, label: z.string().min(1).max(120), group: fieldIdSchema,
  kind: z.enum(['enum', 'number', 'tags']), status: statusSchema, selfControl: z.string().min(1).max(64),
  requirementControl: z.string().min(1).max(64), allowedOperators: z.array(z.string().min(1).max(32)).max(16),
  requiredSelf: z.boolean(), sensitive: z.boolean(), sourceItem: z.string().max(160), note: z.string().max(1000),
  scoreEnabled: z.boolean(), options: z.array(optionSchema).optional(), presets: z.array(presetSchema),
  relativePresets: z.array(relativePresetSchema).optional(), unit: z.string().max(40).optional(),
  minimum: z.number().finite().optional(), maximum: z.number().finite().optional(), step: z.number().positive().finite().optional(),
}).strict();
const distributionSchema: z.ZodType<Distribution> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('categorical'), mass: z.record(optionIdSchema, z.number().min(0).max(1)) }).strict(),
  z.object({ kind: z.literal('independent_tags'), mass: z.record(optionIdSchema, z.number().min(0).max(1)) }).strict(),
  z.object({
    kind: z.literal('bucket_uniform_discrete'),
    buckets: z.array(z.object({ from: z.number().finite(), toExclusive: z.number().finite(), mass: z.number().min(0).max(1) }).strict()).min(1),
  }).strict(),
]);
const scoreSchema: z.ZodType<ScoreDefinition> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('excluded'), weight: z.literal(0) }).strict(),
  z.object({ kind: z.literal('category_map'), weight: z.number().positive().finite(), values: z.record(optionIdSchema, z.number().min(0).max(100)) }).strict(),
  z.object({
    kind: z.literal('piecewise_linear'), weight: z.number().positive().finite(),
    knots: z.array(z.object({ value: z.number().finite(), score: z.number().min(0).max(100) }).strict()).min(2),
  }).strict(),
]);

export const runtimeConfigBundleSchema = z.object({
  schemaVersion: z.literal('2.0.0'), configBundleVersion: versionSchema, noticeVersion: versionSchema,
  catalog: z.object({
    schemaVersion: versionSchema, catalogVersion: versionSchema, language: z.string().min(1).max(16),
    groups: z.array(z.object({ id: fieldIdSchema, label: z.string().min(1).max(120) }).strict()).min(1),
    fields: z.array(catalogFieldSchema).min(1).max(512),
  }).strict(),
  model: z.object({
    schemaVersion: versionSchema, modelVersion: versionSchema, catalogVersion: versionSchema,
    status: z.enum(['synthetic-demo', 'researched']), basePopulation: z.number().positive().finite(), adultFraction: z.number().positive().max(1),
    currency: z.object({
      base: z.literal('CNY'), demoCnyPerUnit: z.object({ CNY: z.number().positive(), JPY: z.number().positive() }).strict(),
      status: z.string().min(1).max(120), rateVersion: versionSchema,
    }).strict(),
    fields: z.record(fieldIdSchema, z.object({ distribution: distributionSchema, score: scoreSchema }).strict()),
  }).strict(),
  cities: z.array(z.object({
    id: fieldIdSchema, label: z.string().min(1).max(120), titleLabel: z.string().min(1).max(40),
    status: statusSchema, populationMass: z.number().positive().max(1),
  }).strict()).min(1).max(1000),
  cityResidualMass: z.number().min(0).max(1), defaultCityId: fieldIdSchema,
  reachTiers: z.array(z.object({
    id: fieldIdSchema, label: z.string().min(1).max(120), people: z.number().int().positive(), status: statusSchema, isDefault: z.boolean(),
  }).strict()).min(1).max(64),
  reachBoosts: z.array(z.object({
    id: fieldIdSchema, label: z.string().min(1).max(120), incrementRate: z.number().min(0).max(100), status: statusSchema,
  }).strict()).max(64),
  strictnessLevels: z.array(z.object({
    id: fieldIdSchema, label: z.string().min(1).max(120), coefficient: z.number().min(0).max(1), isDefault: z.boolean(),
  }).strict()).length(5),
}).strict();

export function parseSaveRequest(value: unknown): SaveRequest {
  return saveRequestSchema.parse(value) as SaveRequest;
}

export function parseRuntimeConfigBundle(value: unknown): RuntimeConfigBundle {
  return runtimeConfigBundleSchema.parse(value) as RuntimeConfigBundle;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(',')}}`;
}

export function isFieldId(value: string): value is FieldId {
  return idPattern.test(value);
}
