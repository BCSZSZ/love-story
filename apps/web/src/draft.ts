import { useCallback, useEffect, useReducer } from 'react';
import type {
  CurrencyInput,
  FieldId,
  NormalizedInput,
  OwnAnswer,
  Requirement,
  RuntimeConfigBundle,
  SaveAck,
} from '@tls/domain';
import { contextFor, DEFAULT_CONFIG_CHECKSUM, defaultRuntimeConfig } from '@tls/model-config';

export type SaveStatus =
  | 'local'
  | 'pending'
  | 'uploading'
  | 'saved'
  | 'failed'
  | 'conflict'
  | 'expired'
  | 'disabled';

export interface Draft extends NormalizedInput {
  schemaVersion: '2.0.0';
  configBundleVersion: string;
  configChecksum: string;
  recordId: string;
  managementToken: string;
  acceptedRevision: number;
  localCreatedAt: string;
  localUpdatedAt: string;
  expiresAt?: number;
  state: 'draft' | 'completed';
  noticeVersion: string;
  catalogVersion: string;
  modelVersion: string;
  fxVersion: string;
  cityConfirmed: boolean;
  saveStatus: SaveStatus;
  saveMessage?: string;
  storageAvailable: boolean;
}

type Action =
  | { type: 'own'; fieldId: FieldId; answer?: OwnAnswer; currencyInput?: CurrencyInput }
  | { type: 'requirement'; fieldId: FieldId; requirement: Requirement }
  | { type: 'requirements'; requirements: Draft['requirements'] }
  | { type: 'city'; cityId: string }
  | { type: 'reach'; tierId: string; boostIds: string[] }
  | { type: 'adopt-config'; config: RuntimeConfigBundle; checksum: string }
  | { type: 'complete' }
  | { type: 'save-status'; status: SaveStatus; message?: string }
  | { type: 'save-ack'; ack: SaveAck }
  | { type: 'storage-failed' }
  | { type: 'replace'; draft: Draft };

const STORAGE_KEY = 'tls:draft:v2';
const LEGACY_STORAGE_KEY = 'tls:draft:v1';
const MANAGED_KEY = 'tls:managed-records:v1';

export interface ManagedRecord {
  recordId: string;
  managementToken: string;
  expiresAt?: number;
}

export function getManagedRecords(): ManagedRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(MANAGED_KEY) ?? '[]') as ManagedRecord[];
    const now = Date.now() / 1000;
    return parsed.filter((entry) => entry.recordId && entry.managementToken && (!entry.expiresAt || entry.expiresAt > now));
  } catch {
    return [];
  }
}

export function removeManagedRecord(recordId: string): void {
  localStorage.setItem(MANAGED_KEY, JSON.stringify(getManagedRecords().filter((entry) => entry.recordId !== recordId)));
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function defaultTier(config: RuntimeConfigBundle): string {
  return config.reachTiers.find((tier) => tier.status === 'active' && tier.isDefault)?.id
    ?? config.reachTiers.find((tier) => tier.status === 'active')?.id
    ?? 'daily';
}

export function createBlankDraft(config: RuntimeConfigBundle = defaultRuntimeConfig, checksum = DEFAULT_CONFIG_CHECKSUM): Draft {
  const timestamp = new Date().toISOString();
  const context = contextFor(config);
  return {
    schemaVersion: '2.0.0',
    ...context,
    configChecksum: checksum,
    recordId: crypto.randomUUID(),
    managementToken: randomToken(),
    acceptedRevision: 0,
    localCreatedAt: timestamp,
    localUpdatedAt: timestamp,
    state: 'draft',
    noticeVersion: config.noticeVersion,
    matchCityId: config.defaultCityId,
    cityConfirmed: true,
    reach: { tierId: defaultTier(config), boostIds: [] },
    own: {},
    requirements: {},
    currencyInputs: {},
    saveStatus: 'local',
    storageAvailable: true,
  };
}

function touch(state: Draft, changes: Partial<Draft>): Draft {
  return {
    ...state,
    ...changes,
    state: 'draft',
    localUpdatedAt: new Date().toISOString(),
    saveStatus: 'pending',
    saveMessage: undefined,
  };
}

function reducer(state: Draft, action: Action): Draft {
  switch (action.type) {
    case 'own': {
      const own = { ...state.own };
      const currencyInputs = { ...state.currencyInputs };
      if (action.answer) own[action.fieldId] = action.answer;
      else delete own[action.fieldId];
      if (action.currencyInput) currencyInputs[action.fieldId] = action.currencyInput;
      else delete currencyInputs[action.fieldId];
      return touch(state, { own, currencyInputs });
    }
    case 'requirement':
      return touch(state, { requirements: { ...state.requirements, [action.fieldId]: action.requirement } });
    case 'requirements':
      return touch(state, { requirements: structuredClone(action.requirements) });
    case 'city':
      return touch(state, { matchCityId: action.cityId, cityConfirmed: true });
    case 'reach':
      return touch(state, { reach: { tierId: action.tierId, boostIds: [...new Set(action.boostIds)] } });
    case 'adopt-config': {
      if (state.acceptedRevision > 0 || hasMeaningfulContent(state)) return state;
      const context = contextFor(action.config);
      return {
        ...state,
        ...context,
        configChecksum: action.checksum,
        noticeVersion: action.config.noticeVersion,
        matchCityId: action.config.defaultCityId,
        reach: { tierId: defaultTier(action.config), boostIds: [] },
      };
    }
    case 'complete':
      return { ...state, state: 'completed', localUpdatedAt: new Date().toISOString(), saveStatus: 'pending', saveMessage: undefined };
    case 'save-status':
      return { ...state, saveStatus: action.status, ...(action.message ? { saveMessage: action.message } : { saveMessage: undefined }) };
    case 'save-ack':
      return { ...state, acceptedRevision: action.ack.acceptedRevision, expiresAt: action.ack.expiresAt, saveStatus: 'saved', saveMessage: undefined };
    case 'storage-failed':
      return { ...state, storageAvailable: false, saveStatus: 'disabled', saveMessage: '本机存储不可用，仅本次页面有效。' };
    case 'replace':
      return action.draft;
  }
}

interface LegacyDraft {
  schemaVersion?: string;
  recordId?: string;
  managementToken?: string;
  acceptedRevision?: number;
  localCreatedAt?: string;
  localUpdatedAt?: string;
  expiresAt?: number;
  state?: 'draft' | 'completed';
  own?: Record<string, OwnAnswer>;
  requirements?: Record<string, { state: 'any' } | { state: 'required'; predicate: unknown }>;
  currencyInputs?: Record<string, CurrencyInput>;
}

function migrateLegacy(raw: LegacyDraft, config: RuntimeConfigBundle, checksum: string): Draft {
  const draft = createBlankDraft(config, checksum);
  const own = { ...(raw.own ?? {}) };
  const requirements = { ...(raw.requirements ?? {}) } as Record<string, Requirement>;
  const currencyInputs = { ...(raw.currencyInputs ?? {}) };
  const ownResidence = own.residence?.state === 'answered' && typeof own.residence.value === 'string'
    ? own.residence.value
    : undefined;
  const oldResidence = requirements.residence;
  const requiredResidence = oldResidence?.state === 'required' &&
    typeof oldResidence.predicate === 'object' && oldResidence.predicate !== null &&
    'op' in oldResidence.predicate && oldResidence.predicate.op === 'in' &&
    'values' in oldResidence.predicate && Array.isArray(oldResidence.predicate.values) &&
    oldResidence.predicate.values.length === 1
      ? String(oldResidence.predicate.values[0])
      : undefined;
  delete own.residence;
  delete requirements.residence;
  delete currencyInputs.residence;
  const activeCityIds = new Set(config.cities.filter((city) => city.status === 'active').map((city) => city.id));
  const suggested = ownResidence && requiredResidence && ownResidence === requiredResidence && activeCityIds.has(ownResidence)
    ? ownResidence
    : activeCityIds.has(ownResidence ?? '')
      ? ownResidence
      : activeCityIds.has(requiredResidence ?? '')
        ? requiredResidence
        : config.defaultCityId;
  const defaultStrictness = config.strictnessLevels.find((level) => level.isDefault)?.id ?? 'must';
  const migratedRequirements = Object.fromEntries(Object.entries(requirements).map(([fieldId, requirement]) => [
    fieldId,
    requirement.state === 'required'
      ? { ...requirement, strictnessLevelId: defaultStrictness }
      : requirement,
  ])) as Draft['requirements'];
  return {
    ...draft,
    recordId: raw.recordId ?? draft.recordId,
    managementToken: raw.managementToken ?? draft.managementToken,
    acceptedRevision: raw.acceptedRevision ?? 0,
    localCreatedAt: raw.localCreatedAt ?? draft.localCreatedAt,
    localUpdatedAt: new Date().toISOString(),
    ...(raw.expiresAt ? { expiresAt: raw.expiresAt } : {}),
    state: 'draft',
    matchCityId: suggested ?? config.defaultCityId,
    cityConfirmed: false,
    own,
    requirements: migratedRequirements,
    currencyInputs,
    saveStatus: 'pending',
    saveMessage: '旧草稿已保留，请确认匹配城市后再完成或上传。',
  };
}

function isExpired(draft: Pick<Draft, 'localCreatedAt' | 'expiresAt'>): boolean {
  const localExpiry = new Date(draft.localCreatedAt);
  localExpiry.setUTCFullYear(localExpiry.getUTCFullYear() + 1);
  return Boolean((draft.expiresAt && draft.expiresAt <= Date.now() / 1000) || localExpiry.getTime() <= Date.now());
}

function loadDraft(config: RuntimeConfigBundle, checksum: string): Draft {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      const parsed = JSON.parse(current) as Draft;
      if (!isExpired(parsed) && parsed.schemaVersion === '2.0.0' && parsed.recordId && parsed.managementToken) {
        return {
          ...parsed,
          configChecksum: parsed.configChecksum || (parsed.configBundleVersion === config.configBundleVersion ? checksum : ''),
          saveStatus: parsed.acceptedRevision ? 'saved' : parsed.saveStatus === 'pending' ? 'pending' : 'local',
          storageAvailable: true,
        };
      }
      localStorage.removeItem(STORAGE_KEY);
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return migrateLegacy(JSON.parse(legacy) as LegacyDraft, config, checksum);
    return createBlankDraft(config, checksum);
  } catch {
    return { ...createBlankDraft(config, checksum), storageAvailable: false, saveStatus: 'disabled' };
  }
}

export function useDraft(initialConfig: RuntimeConfigBundle = defaultRuntimeConfig, initialChecksum = DEFAULT_CONFIG_CHECKSUM) {
  const [draft, dispatch] = useReducer(
    reducer,
    { config: initialConfig, checksum: initialChecksum },
    ({ config, checksum }) => loadDraft(config, checksum),
  );

  useEffect(() => {
    if (!draft.storageAvailable) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      dispatch({ type: 'storage-failed' });
    }
  }, [draft]);

  const setOwn = useCallback((fieldId: FieldId, answer?: OwnAnswer, currencyInput?: CurrencyInput) => {
    dispatch({ type: 'own', fieldId, ...(answer ? { answer } : {}), ...(currencyInput ? { currencyInput } : {}) });
  }, []);
  const setRequirement = useCallback((fieldId: FieldId, requirement: Requirement) => dispatch({ type: 'requirement', fieldId, requirement }), []);
  const setRequirements = useCallback((requirements: Draft['requirements']) => dispatch({ type: 'requirements', requirements }), []);
  const setMatchCity = useCallback((cityId: string) => dispatch({ type: 'city', cityId }), []);
  const setReach = useCallback((tierId: string, boostIds: string[]) => dispatch({ type: 'reach', tierId, boostIds }), []);
  const adoptConfig = useCallback((config: RuntimeConfigBundle, checksum: string) => dispatch({ type: 'adopt-config', config, checksum }), []);

  const newDraft = useCallback((config: RuntimeConfigBundle = initialConfig, checksum = initialChecksum) => {
    try {
      const meaningful = hasMeaningfulContent(draft);
      if (draft.acceptedRevision > 0 || meaningful) {
        const entry: ManagedRecord = {
          recordId: draft.recordId,
          managementToken: draft.managementToken,
          ...(draft.expiresAt ? { expiresAt: draft.expiresAt } : {}),
        };
        const deduplicated = [...getManagedRecords().filter((item) => item.recordId !== draft.recordId), entry];
        localStorage.setItem(MANAGED_KEY, JSON.stringify(deduplicated.slice(-20)));
      }
    } catch {
      // A new local draft remains usable when optional credential archiving fails.
    }
    dispatch({ type: 'replace', draft: createBlankDraft(config, checksum) });
  }, [draft, initialChecksum, initialConfig]);

  const clearLocal = useCallback((config: RuntimeConfigBundle = initialConfig, checksum = initialChecksum) => {
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'replace', draft: createBlankDraft(config, checksum) });
  }, [initialChecksum, initialConfig]);

  return {
    draft,
    setOwn,
    setRequirement,
    setRequirements,
    setMatchCity,
    setReach,
    adoptConfig,
    markCompleted: useCallback(() => dispatch({ type: 'complete' }), []),
    setSaveStatus: useCallback((status: SaveStatus, message?: string) => dispatch({ type: 'save-status', status, ...(message ? { message } : {}) }), []),
    acceptSave: useCallback((ack: SaveAck) => dispatch({ type: 'save-ack', ack }), []),
    newDraft,
    clearLocal,
  };
}

export function hasMeaningfulContent(draft: Draft): boolean {
  return draft.state === 'completed' || Object.values(draft.own).some((answer) => answer?.state === 'answered') ||
    Object.values(draft.requirements).some((requirement) => requirement?.state === 'required');
}

export const draftStorageKey = STORAGE_KEY;
