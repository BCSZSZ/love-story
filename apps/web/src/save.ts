import { useCallback, useEffect, useRef } from 'react';
import { canonicalJson, type SaveAck, type SaveRequest } from '@tls/domain';
import type { Draft, SaveStatus } from './draft';
import { hasMeaningfulContent } from './draft';

interface SaveEnvelope {
  request: SaveRequest;
  fingerprint: string;
}

interface SaveBindings {
  draft: Draft;
  enabled?: boolean;
  setStatus: (status: SaveStatus, message?: string) => void;
  accept: (ack: SaveAck) => void;
}

function makeRequest(draft: Draft, revision: number): SaveRequest {
  return {
    recordId: draft.recordId,
    revision,
    schemaVersion: draft.schemaVersion,
    state: draft.state,
    configChecksum: draft.configChecksum,
    configBundleVersion: draft.configBundleVersion,
    noticeVersion: draft.noticeVersion,
    catalogVersion: draft.catalogVersion,
    modelVersion: draft.modelVersion,
    fxVersion: draft.fxVersion,
    matchCityId: draft.matchCityId,
    reach: draft.reach,
    own: draft.own,
    requirements: draft.requirements,
    currencyInputs: draft.currencyInputs,
  };
}

function contentFingerprint(draft: Draft): string {
  return canonicalJson({
    state: draft.state,
    configChecksum: draft.configChecksum,
    matchCityId: draft.matchCityId,
    reach: draft.reach,
    own: draft.own,
    requirements: draft.requirements,
    currencyInputs: draft.currencyInputs,
  });
}

export function useCloudSave({ draft, enabled = true, setStatus, accept }: SaveBindings) {
  const draftRef = useRef(draft);
  const inFlight = useRef(false);
  const envelope = useRef<SaveEnvelope | undefined>(undefined);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastAttemptAt = useRef(0);
  const retryIndex = useRef(0);
  const lastAcceptedFingerprint = useRef<string | undefined>(undefined);
  const conflictLatestRevision = useRef<number | undefined>(undefined);
  const abortController = useRef<AbortController | undefined>(undefined);
  const generation = useRef(0);

  draftRef.current = draft;

  const send = useCallback(async () => {
    if (!enabled || inFlight.current || !hasMeaningfulContent(draftRef.current)) return;
    const current = draftRef.current;
    const currentGeneration = generation.current;
    const latestFingerprint = contentFingerprint(current);
    const currentEnvelope =
      envelope.current ?? {
        request: makeRequest(current, current.acceptedRevision + 1),
        fingerprint: latestFingerprint,
      };
    envelope.current = currentEnvelope;
    inFlight.current = true;
    abortController.current = new AbortController();
    lastAttemptAt.current = Date.now();
    setStatus('uploading');
    try {
      const creating = currentEnvelope.request.revision === 1;
      const response = await fetch(
        creating ? '/api/v1/records' : `/api/v1/records/${encodeURIComponent(currentEnvelope.request.recordId)}`,
        {
          method: creating ? 'POST' : 'PUT',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${current.managementToken}`,
          },
          body: JSON.stringify(currentEnvelope.request),
          signal: abortController.current.signal,
        },
      );
      if (generation.current !== currentGeneration) return;
      const payload = (await response.json().catch(() => ({}))) as SaveAck & {
        error?: { code?: string; message?: string };
      };
      if (!response.ok) {
        if (response.status === 409) {
          const latest = payload.error && 'details' in payload.error
            ? Number((payload.error as { details?: { latestRevision?: number } }).details?.latestRevision)
            : Number.NaN;
          if (Number.isInteger(latest) && latest > 0) conflictLatestRevision.current = latest;
          setStatus('conflict', '云端记录版本冲突；已保留本机内容。重试将明确保留当前标签页版本。');
        }
        else if (response.status === 410) setStatus('expired', '记录已到期或删除，云端不会再更新。');
        else if (response.status === 429) setStatus('failed', '请求较多，已暂停自动重试。');
        else setStatus('failed', payload.error?.message ?? '云端保存失败，本机内容仍已保留。');
        if (![409, 410, 429, 400, 403, 413].includes(response.status) && retryIndex.current < 3) {
          const delay = [2_000, 5_000, 15_000][retryIndex.current] ?? 15_000;
          retryIndex.current += 1;
          timeout.current = setTimeout(() => void send(), delay);
        }
        return;
      }
      retryIndex.current = 0;
      conflictLatestRevision.current = undefined;
      envelope.current = undefined;
      lastAcceptedFingerprint.current = currentEnvelope.fingerprint;
      accept(payload);
    } catch {
      if (generation.current !== currentGeneration) return;
      setStatus('failed', '网络不可用；本机计算和导图不受影响。');
      if (retryIndex.current < 3) {
        const delay = [2_000, 5_000, 15_000][retryIndex.current] ?? 15_000;
        retryIndex.current += 1;
        timeout.current = setTimeout(() => void send(), delay);
      }
    } finally {
      inFlight.current = false;
      abortController.current = undefined;
      if (generation.current === currentGeneration) {
        const latest = contentFingerprint(draftRef.current);
        if (!envelope.current && latest !== lastAcceptedFingerprint.current && hasMeaningfulContent(draftRef.current)) {
          const wait = draftRef.current.state === 'completed' ? 0 : Math.max(1_500, 10_000 - (Date.now() - lastAttemptAt.current));
          timeout.current = setTimeout(() => void send(), wait);
        }
      }
    }
  }, [accept, enabled, setStatus]);

  const fingerprint = contentFingerprint(draft);
  useEffect(() => {
    if (!enabled || !hasMeaningfulContent(draft) || fingerprint === lastAcceptedFingerprint.current || conflictLatestRevision.current !== undefined) return;
    setStatus('pending');
    if (timeout.current) clearTimeout(timeout.current);
    const minimumGap = Math.max(0, 10_000 - (Date.now() - lastAttemptAt.current));
    const delay = draft.state === 'completed' ? 0 : Math.max(1_500, minimumGap);
    timeout.current = setTimeout(() => void send(), delay);
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [draft.state, enabled, fingerprint, send, setStatus]);

  useEffect(() => {
    const handleOnline = () => {
      if (draftRef.current.saveStatus === 'failed') void send();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [send]);

  return {
    retry: () => {
      retryIndex.current = 0;
      if (timeout.current) clearTimeout(timeout.current);
      if (conflictLatestRevision.current !== undefined) {
        const current = draftRef.current;
        const fingerprint = contentFingerprint(current);
        envelope.current = {
          request: makeRequest(current, conflictLatestRevision.current + 1),
          fingerprint,
        };
        conflictLatestRevision.current = undefined;
      }
      void send();
    },
    cancel: () => {
      generation.current += 1;
      abortController.current?.abort();
      if (timeout.current) clearTimeout(timeout.current);
      envelope.current = undefined;
      conflictLatestRevision.current = undefined;
    },
  };
}
