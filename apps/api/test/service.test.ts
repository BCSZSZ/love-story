import { describe, expect, it } from 'vitest';
import type { SaveRequest } from '@tls/domain';
import { DEFAULT_CONFIG_CHECKSUM, SUPPORTED_VERSIONS } from '@tls/model-config';
import { MemoryRecordRepository } from '../src/repository';
import { addOneCalendarYearUtc, ApiError, RecordService } from '../src/service';

const token = 'a'.repeat(43);
const otherToken = 'b'.repeat(43);

function request(recordId = '123e4567-e89b-42d3-a456-426614174000'): SaveRequest {
  return {
    recordId,
    revision: 1,
    schemaVersion: '2.0.0',
    configChecksum: DEFAULT_CONFIG_CHECKSUM,
    configBundleVersion: SUPPORTED_VERSIONS.configBundleVersion,
    state: 'draft',
    noticeVersion: SUPPORTED_VERSIONS.noticeVersion,
    catalogVersion: SUPPORTED_VERSIONS.catalogVersion,
    modelVersion: SUPPORTED_VERSIONS.modelVersion,
    fxVersion: SUPPORTED_VERSIONS.fxVersion,
    matchCityId: 'jp_tokyo',
    reach: { tierId: 'daily', boostIds: [] },
    own: { age: { state: 'answered', value: 32 } },
    requirements: {
      university_tier: { state: 'required', strictnessLevelId: 'must', predicate: { op: 'in', values: ['985'] } },
    },
    currencyInputs: {},
  };
}

describe('calendar expiry', () => {
  it('maps leap day to February 28 at the same UTC time', () => {
    expect(addOneCalendarYearUtc(new Date('2028-02-29T12:34:56.789Z')).toISOString()).toBe('2029-02-28T12:34:56.789Z');
  });
});

describe('anonymous record service', () => {
  it('makes POST retries idempotent and keeps the original expiry', async () => {
    const repository = new MemoryRecordRepository();
    const now = new Date('2026-09-27T00:00:00.000Z');
    const service = new RecordService(repository, () => now);
    const first = await service.create(request(), token);
    const retry = await service.create(request(), token);
    expect(retry).toEqual(first);
    expect(first.computedSummary.cityCandidatePool.expectedApprox).toBeCloseTo(112_000, 4);
    expect(first.computedSummary.reachableCandidateCount.expectedApprox).toBeCloseTo(20, 8);
    expect((await repository.get(first.recordId))?.createdAt).toBe(now.toISOString());
  });

  it('rejects a wrong token and enforces revision CAS with idempotent PUT retry', async () => {
    const repository = new MemoryRecordRepository();
    const service = new RecordService(repository, () => new Date('2026-09-27T00:00:00.000Z'));
    const created = await service.create(request(), token);
    await expect(service.replace(created.recordId, { ...request(), revision: 2 }, otherToken)).rejects.toMatchObject({
      code: 'UNAUTHORIZED_RECORD',
    });
    const replacement = { ...request(), revision: 2, state: 'completed' as const };
    const updated = await service.replace(created.recordId, replacement, token);
    const retry = await service.replace(created.recordId, replacement, token);
    expect(updated.acceptedRevision).toBe(2);
    expect(retry).toEqual(updated);
    expect(updated.expiresAt).toBe(created.expiresAt);
    await expect(service.replace(created.recordId, { ...replacement, revision: 4 }, token)).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
  });

  it('uses a tombstone so late POST/PUT requests cannot restore deleted content', async () => {
    const repository = new MemoryRecordRepository();
    const service = new RecordService(repository, () => new Date('2026-09-27T00:00:00.000Z'));
    const created = await service.create(request(), token);
    await service.delete(created.recordId, token);
    expect((await repository.get(created.recordId))?.snapshot).toBeUndefined();
    await expect(service.create(request(), token)).rejects.toMatchObject({ code: 'RECORD_EXPIRED_OR_DELETED' });
    await expect(service.replace(created.recordId, { ...request(), revision: 2 }, token)).rejects.toMatchObject({
      code: 'RECORD_EXPIRED_OR_DELETED',
    });
  });

  it('never accepts a client-computed result field', async () => {
    const service = new RecordService(new MemoryRecordRepository());
    await expect(service.create({ ...request(), result: { expectedApprox: 0 } }, token)).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects unknown option IDs instead of silently ignoring them', async () => {
    const service = new RecordService(new MemoryRecordRepository());
    const invalid = request();
    invalid.requirements.gender = { state: 'required', strictnessLevelId: 'must', predicate: { op: 'in', values: ['invented'] } };
    await expect(service.create(invalid, token)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('treats the record as expired after one fixed calendar year', async () => {
    let now = new Date('2026-09-27T00:00:00.000Z');
    const repository = new MemoryRecordRepository();
    const service = new RecordService(repository, () => now);
    const created = await service.create(request(), token);
    now = new Date('2027-09-27T00:00:00.000Z');
    await expect(service.replace(created.recordId, { ...request(), revision: 2 }, token)).rejects.toMatchObject({
      code: 'RECORD_EXPIRED_OR_DELETED',
    });
  });
});
