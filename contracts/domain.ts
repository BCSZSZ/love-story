/**
 * Schema-v2 reference contract.
 *
 * The executable source of truth is packages/domain/src/index.ts.  Keeping this
 * file as type-only re-exports prevents the design reference from drifting back
 * to the removed fixed 63-field union or schema v1.
 */
export type {
  AcceptanceEstimator,
  CatalogConfig,
  CatalogField,
  CatalogOption,
  CatalogPreset,
  ConfigValidationIssue,
  ConfigVersionMetadata,
  CurrencyInput,
  Distribution,
  ExpectedCount,
  FieldId,
  InputIssue,
  MatchCity,
  ModelConfig,
  ModelContext,
  NormalizedInput,
  OwnAnswer,
  PopulationResult,
  PopulationTraceStep,
  Predicate,
  PublicRecordStore,
  ReachBoost,
  ReachSelection,
  ReachTier,
  RelativePreset,
  Relaxation,
  Requirement,
  RuntimeConfigBundle,
  SaveAck,
  SaveRequest,
  Scalar,
  ScoreDefinition,
  ScoreResult,
  SnapshotComputed,
  SnapshotInput,
  StrictnessLevel,
  StrictnessLevelId,
} from '../packages/domain/src/index';

