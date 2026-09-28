import { useEffect, useMemo, useState } from 'react';
import { canonicalJson, parseRuntimeConfigBundle, type RuntimeConfigBundle } from '@tls/domain';
import {
  DEFAULT_CONFIG_CHECKSUM,
  defaultRuntimeConfig,
  normalizeRuntimeConfig,
  validateRuntimeConfig,
} from '@tls/model-config';

const CACHE_PREFIX = 'tls:runtime-config:v2:';

export interface LoadedRuntimeConfig {
  config: RuntimeConfigBundle;
  checksum: string;
  source: 'service' | 'cache' | 'fallback';
  message?: string;
}

async function sha256Config(config: RuntimeConfigBundle): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(normalizeRuntimeConfig(config)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function readCache(version: string): LoadedRuntimeConfig | undefined {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${version}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { config: unknown; checksum: string };
    const config = parseRuntimeConfigBundle(parsed.config);
    if (validateRuntimeConfig(config).issues.length) return undefined;
    return { config, checksum: parsed.checksum, source: 'cache' };
  } catch {
    return undefined;
  }
}

function writeCache(config: RuntimeConfigBundle, checksum: string): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${config.configBundleVersion}`, JSON.stringify({ config, checksum }));
  } catch {
    // An otherwise valid loaded configuration remains usable without optional caching.
  }
}

export function useRuntimeConfig(requestedVersion?: string): LoadedRuntimeConfig & { loading: boolean } {
  const fallback = useMemo<LoadedRuntimeConfig>(() => ({
    config: defaultRuntimeConfig,
    checksum: DEFAULT_CONFIG_CHECKSUM,
    source: 'fallback',
    message: '当前使用随页面发布的已验证演示配置。',
  }), []);
  const [loaded, setLoaded] = useState<LoadedRuntimeConfig>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      const version = requestedVersion || undefined;
      const cached = version ? readCache(version) : undefined;
      try {
        const response = await fetch(
          version ? `/api/v2/config/${encodeURIComponent(version)}` : '/api/v2/config/active',
          { headers: { accept: 'application/json' }, signal: controller.signal },
        );
        if (!response.ok) throw new Error(`config_${response.status}`);
        const payload = await response.json() as { config?: unknown; checksum?: string } | RuntimeConfigBundle;
        const configValue = 'config' in payload ? payload.config : payload;
        const suppliedChecksum = 'checksum' in payload ? payload.checksum : undefined;
        const config = parseRuntimeConfigBundle(configValue);
        const validation = validateRuntimeConfig(config);
        if (validation.issues.length) throw new Error('config_validation_failed');
        const checksum = await sha256Config(config);
        if (suppliedChecksum && suppliedChecksum !== checksum) throw new Error('config_checksum_mismatch');
        writeCache(config, checksum);
        if (!controller.signal.aborted) setLoaded({ config, checksum, source: 'service' });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (cached) {
          const actual = await sha256Config(cached.config);
          if (actual === cached.checksum) {
            setLoaded({ ...cached, message: '配置服务暂不可用，继续使用已校验的固定版本缓存。' });
            return;
          }
        }
        if (!version) setLoaded(fallback);
        else setLoaded({ ...fallback, message: '指定的历史配置暂不可用；本机原答案仍会保留，当前不能上传。' });
        void error;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [fallback, requestedVersion]);

  return { ...loaded, loading };
}

export async function computeRuntimeConfigChecksum(config: RuntimeConfigBundle): Promise<string> {
  return sha256Config(config);
}
