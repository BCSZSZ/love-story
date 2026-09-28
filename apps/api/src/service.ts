import { createHash, timingSafeEqual } from 'node:crypto';
import {
  canonicalJson,
  parseSaveRequest,
  type SaveAck,
  type SaveRequest,
  type SnapshotComputed,
} from '@tls/domain';
import { createRuntimeEngine, type RuntimeEngine } from '@tls/engine';
import { contextFor } from '@tls/model-config';
import { MemoryConfigStore, type ConfigStore } from './config-store.js';
import type { RecordRepository, StoredRecord } from './repository.js';

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED_RECORD'
  | 'NOT_FOUND'
  | 'REVISION_CONFLICT'
  | 'MODEL_VERSION_UNSUPPORTED'
  | 'RECORD_EXPIRED_OR_DELETED'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'TEMPORARY_UNAVAILABLE';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED_RECORD: 403,
  NOT_FOUND: 404,
  REVISION_CONFLICT: 409,
  MODEL_VERSION_UNSUPPORTED: 409,
  RECORD_EXPIRED_OR_DELETED: 410,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  TEMPORARY_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = STATUS_BY_CODE[code];
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(sha256(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function addOneCalendarYearUtc(date: Date): Date {
  const year = date.getUTCFullYear() + 1;
  const month = date.getUTCMonth();
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(date.getUTCDate(), maxDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function assertToken(token: string): void {
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) {
    throw new ApiError('UNAUTHORIZED_RECORD', '管理凭据无效。');
  }
}

async function assertSupported(request: SaveRequest, configStore: ConfigStore): Promise<RuntimeEngine> {
  const loaded = await configStore.getVersion(request.configBundleVersion);
  if (!loaded) throw new ApiError('MODEL_VERSION_UNSUPPORTED', '提交使用的配置包不存在或已不受支持。');
  const context = contextFor(loaded.config);
  if (
    request.schemaVersion !== '2.0.0' ||
    request.catalogVersion !== context.catalogVersion ||
    request.modelVersion !== context.modelVersion ||
    request.fxVersion !== context.fxVersion ||
    request.configChecksum !== loaded.metadata.checksum
  ) {
    throw new ApiError('MODEL_VERSION_UNSUPPORTED', '提交使用的模型版本不受支持。');
  }
  return createRuntimeEngine(loaded.config, loaded.metadata.checksum);
}

async function parseAndValidate(value: unknown, configStore: ConfigStore): Promise<{ request: SaveRequest; engine: RuntimeEngine }> {
  let request: SaveRequest;
  try {
    request = parseSaveRequest(value);
  } catch {
    throw new ApiError('INVALID_INPUT', '请求结构或字段值无效。');
  }
  const engine = await assertSupported(request, configStore);
  if (Buffer.byteLength(canonicalJson(request), 'utf8') > 32_768) {
    throw new ApiError('PAYLOAD_TOO_LARGE', '结构化快照超过 32KiB 设计上限。');
  }
  const issues = engine.validateInput(request, engine.context);
  const blocking = issues.filter((entry) => entry.code !== 'missing_relative_source');
  if (blocking.length) {
    throw new ApiError('INVALID_INPUT', '提交包含无效字段。', {
      issues: blocking.map(({ fieldId, code }) => ({ fieldId, code })),
    });
  }
  if (request.state === 'completed' && issues.length) {
    throw new ApiError('INVALID_INPUT', '仍有待补充的相对要求，不能标记为完成。', {
      issues: issues.map(({ fieldId, code }) => ({ fieldId, code })),
    });
  }
  return { request, engine };
}

function computeSnapshot(request: SaveRequest, engine: RuntimeEngine): SnapshotComputed {
  const computed = engine.evaluate(request, engine.context);
  return {
    schemaVersion: request.schemaVersion,
    configChecksum: request.configChecksum,
    state: request.state,
    noticeVersion: request.noticeVersion,
    catalogVersion: request.catalogVersion,
    modelVersion: request.modelVersion,
    fxVersion: request.fxVersion,
    configBundleVersion: request.configBundleVersion,
    matchCityId: request.matchCityId,
    reach: request.reach,
    own: request.own,
    requirements: request.requirements,
    currencyInputs: request.currencyInputs,
    result: computed.population,
    scores: computed.scores,
  };
}

function ack(record: StoredRecord): SaveAck {
  const snapshot = record.snapshot;
  if (!snapshot) throw new ApiError('RECORD_EXPIRED_OR_DELETED', '记录已删除。');
  return {
    recordId: record.recordId,
    acceptedRevision: record.revision,
    savedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    computedSummary: {
      cityCandidatePool: {
        expectedApprox: snapshot.result.expectedApprox,
        log10Expected: snapshot.result.log10Expected,
        isMathematicalZero: snapshot.result.isMathematicalZero,
      },
      reachableCandidateCount: snapshot.result.reachable,
      ownScore: snapshot.scores.own.score,
      requirementsScore: snapshot.scores.requirements.score,
    },
  };
}

function isInactive(record: StoredRecord, nowEpoch: number): boolean {
  return Boolean(record.deletedAt) || record.expiresAt <= nowEpoch;
}

export class RecordService {
  constructor(
    private readonly repository: RecordRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly configStore: ConfigStore = new MemoryConfigStore(),
  ) {}

  async create(value: unknown, managementToken: string): Promise<SaveAck> {
    assertToken(managementToken);
    const { request, engine } = await parseAndValidate(value, this.configStore);
    if (request.revision !== 1) throw new ApiError('INVALID_INPUT', '新记录的 revision 必须为 1。');
    const tokenHash = sha256(managementToken);
    const payloadHash = sha256(canonicalJson(request));
    const existing = await this.repository.get(request.recordId);
    const now = this.now();
    const nowEpoch = Math.floor(now.getTime() / 1000);
    if (existing) {
      if (!tokenMatches(managementToken, existing.tokenHash)) {
        throw new ApiError('UNAUTHORIZED_RECORD', '无权管理这条记录。');
      }
      if (isInactive(existing, nowEpoch)) {
        throw new ApiError('RECORD_EXPIRED_OR_DELETED', '记录已到期或删除。');
      }
      if (existing.revision === 1 && existing.payloadHash === payloadHash) return ack(existing);
      throw new ApiError('REVISION_CONFLICT', '记录已经存在且内容不同。', { latestRevision: existing.revision });
    }

    const timestamp = now.toISOString();
    const record: StoredRecord = {
      recordId: request.recordId,
      tokenHash,
      revision: request.revision,
      payloadHash,
      state: request.state,
      schemaVersion: request.schemaVersion,
      configBundleVersion: request.configBundleVersion,
      configChecksum: request.configChecksum,
      catalogVersion: request.catalogVersion,
      modelVersion: request.modelVersion,
      fxVersion: request.fxVersion,
      noticeVersion: request.noticeVersion,
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt: Math.floor(addOneCalendarYearUtc(now).getTime() / 1000),
      snapshot: computeSnapshot(request, engine),
      ...(request.state === 'completed' ? { completedAt: timestamp } : {}),
    };
    if (await this.repository.create(record)) return ack(record);
    const raced = await this.repository.get(request.recordId);
    if (raced && tokenMatches(managementToken, raced.tokenHash) && raced.payloadHash === payloadHash) return ack(raced);
    throw new ApiError('REVISION_CONFLICT', '记录创建发生冲突。', {
      ...(raced ? { latestRevision: raced.revision } : {}),
    });
  }

  async replace(recordId: string, value: unknown, managementToken: string): Promise<SaveAck> {
    assertToken(managementToken);
    const { request, engine } = await parseAndValidate(value, this.configStore);
    if (request.recordId !== recordId) throw new ApiError('INVALID_INPUT', '路径与记录ID不一致。');
    const existing = await this.repository.get(recordId);
    if (!existing) throw new ApiError('NOT_FOUND', '记录不存在。');
    if (!tokenMatches(managementToken, existing.tokenHash)) {
      throw new ApiError('UNAUTHORIZED_RECORD', '无权管理这条记录。');
    }
    const now = this.now();
    const nowEpoch = Math.floor(now.getTime() / 1000);
    if (isInactive(existing, nowEpoch)) {
      throw new ApiError('RECORD_EXPIRED_OR_DELETED', '记录已到期或删除。');
    }
    const payloadHash = sha256(canonicalJson(request));
    if (request.revision === existing.revision && payloadHash === existing.payloadHash) return ack(existing);
    if (request.revision !== existing.revision + 1) {
      throw new ApiError('REVISION_CONFLICT', '记录版本冲突。', { latestRevision: existing.revision });
    }
    const timestamp = now.toISOString();
    const { completedAt: _previousCompletedAt, ...existingWithoutCompletedAt } = existing;
    const replacement: StoredRecord = {
      ...existingWithoutCompletedAt,
      revision: request.revision,
      payloadHash,
      state: request.state,
      schemaVersion: request.schemaVersion,
      configBundleVersion: request.configBundleVersion,
      configChecksum: request.configChecksum,
      catalogVersion: request.catalogVersion,
      modelVersion: request.modelVersion,
      fxVersion: request.fxVersion,
      noticeVersion: request.noticeVersion,
      updatedAt: timestamp,
      snapshot: computeSnapshot(request, engine),
      ...(request.state === 'completed' ? { completedAt: existing.completedAt ?? timestamp } : {}),
    };
    const updated = await this.repository.replace(replacement, existing.revision, existing.tokenHash, nowEpoch);
    if (!updated) {
      const latest = await this.repository.get(recordId);
      throw new ApiError('REVISION_CONFLICT', '记录版本冲突。', {
        ...(latest ? { latestRevision: latest.revision } : {}),
      });
    }
    return ack(replacement);
  }

  async delete(recordId: string, managementToken: string): Promise<void> {
    assertToken(managementToken);
    const existing = await this.repository.get(recordId);
    if (!existing) throw new ApiError('NOT_FOUND', '记录不存在。');
    if (!tokenMatches(managementToken, existing.tokenHash)) {
      throw new ApiError('UNAUTHORIZED_RECORD', '无权管理这条记录。');
    }
    const now = this.now();
    const nowEpoch = Math.floor(now.getTime() / 1000);
    if (isInactive(existing, nowEpoch)) {
      if (existing.deletedAt) return;
      throw new ApiError('RECORD_EXPIRED_OR_DELETED', '记录已到期。');
    }
    const timestamp = now.toISOString();
    const tombstone: StoredRecord = {
      recordId: existing.recordId,
      tokenHash: existing.tokenHash,
      revision: existing.revision + 1,
      payloadHash: sha256('deleted'),
      state: 'draft',
      schemaVersion: existing.schemaVersion,
      catalogVersion: existing.catalogVersion,
      modelVersion: existing.modelVersion,
      fxVersion: existing.fxVersion,
      noticeVersion: existing.noticeVersion,
      createdAt: existing.createdAt,
      updatedAt: timestamp,
      expiresAt: existing.expiresAt,
      deletedAt: timestamp,
    };
    if (!(await this.repository.tombstone(tombstone, existing.revision, existing.tokenHash))) {
      throw new ApiError('REVISION_CONFLICT', '删除时记录发生变化，请重试。');
    }
  }
}

export function parseBearer(value: string | undefined): string {
  if (!value?.startsWith('Bearer ')) throw new ApiError('UNAUTHORIZED_RECORD', '缺少管理凭据。');
  return value.slice('Bearer '.length);
}
