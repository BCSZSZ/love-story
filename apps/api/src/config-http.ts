import type { ConfigVersionMetadata } from '@tls/domain';
import type { ConfigService } from './config-store.js';
import type { HttpRequest, HttpResponse } from './http.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
};

function json(statusCode: number, value: unknown, cacheControl = 'no-store'): HttpResponse {
  return { statusCode, headers: { ...JSON_HEADERS, 'cache-control': cacheControl }, body: JSON.stringify(value) };
}

function parseBody(bodyText: string | undefined): Record<string, unknown> {
  if (!bodyText) throw new Error('EMPTY_BODY');
  if (Buffer.byteLength(bodyText, 'utf8') > 5 * 1024 * 1024) throw new Error('BODY_TOO_LARGE');
  const value = JSON.parse(bodyText) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
  return value as Record<string, unknown>;
}

export interface AdminAuthSettings {
  enabled: boolean;
  issuer?: string;
  clientId?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  redirectUri?: string;
  scope?: string;
}

export async function routePublicConfig(
  service: ConfigService,
  request: HttpRequest,
  auth: AdminAuthSettings,
): Promise<HttpResponse> {
  try {
    if (request.method === 'GET' && request.path === '/api/v2/config/admin-auth') return json(200, auth, 'public, max-age=300');
    if (request.method === 'GET' && request.path === '/api/v2/config/active') {
      const loaded = await service.getActive();
      return json(200, { config: loaded.config, checksum: loaded.metadata.checksum }, 'public, max-age=60, stale-if-error=86400');
    }
    const match = /^\/api\/v2\/config\/([A-Za-z0-9._-]{1,96})$/.exec(request.path);
    if (request.method === 'GET' && match?.[1]) {
      const loaded = await service.getVersion(match[1]);
      return loaded
        ? json(200, { config: loaded.config, checksum: loaded.metadata.checksum }, 'public, max-age=31536000, immutable')
        : json(404, { error: { code: 'CONFIG_NOT_FOUND', message: '配置版本不存在。' } });
    }
    return json(404, { error: { code: 'NOT_FOUND', message: '接口不存在。' } });
  } catch {
    return json(503, { error: { code: 'TEMPORARY_UNAVAILABLE', message: '配置服务暂时不可用。' } });
  }
}

function metadataResponse(metadata: ConfigVersionMetadata | undefined): HttpResponse {
  return metadata
    ? json(200, { metadata })
    : json(409, { error: { code: 'REVISION_CONFLICT', message: '配置版本、状态或 revision 已发生变化。' } });
}

export async function routeAdminConfig(
  service: ConfigService,
  request: HttpRequest,
  actor: string,
): Promise<HttpResponse> {
  try {
    if (request.method === 'GET' && request.path === '/api/admin/v1/configs') {
      const active = await service.getActive();
      const [versions, publishedDefinitions] = await Promise.all([
        service.listVersions(),
        service.publishedDefinitions(),
      ]);
      return json(200, { activeVersion: active.config.configBundleVersion, versions, publishedDefinitions });
    }
    if (request.method === 'POST' && request.path === '/api/admin/v1/configs/validate') {
      const body = parseBody(request.bodyText);
      const result = await service.validate(body.config, typeof body.checksum === 'string' ? body.checksum : undefined);
      return json(result.issues.length ? 422 : 200, { checksum: result.checksum, issues: result.issues });
    }
    if (request.method === 'POST' && request.path === '/api/admin/v1/configs') {
      const body = parseBody(request.bodyText);
      const validation = await service.validate(body.config, typeof body.checksum === 'string' ? body.checksum : undefined);
      if (validation.issues.length) return json(422, { checksum: validation.checksum, issues: validation.issues });
      const metadata = await service.createDraft(body.config, validation.checksum, actor);
      const response = metadataResponse(metadata);
      return metadata ? { ...response, statusCode: 201 } : response;
    }
    const versionMatch = /^\/api\/admin\/v1\/configs\/([A-Za-z0-9._-]{1,96})$/.exec(request.path);
    if (request.method === 'PUT' && versionMatch?.[1]) {
      const body = parseBody(request.bodyText);
      if (!body.config || typeof body.revision !== 'number') return json(400, { error: { code: 'INVALID_INPUT', message: '缺少 config 或 revision。' } });
      const config = body.config as Record<string, unknown>;
      if (config.configBundleVersion !== versionMatch[1]) return json(400, { error: { code: 'INVALID_INPUT', message: '路径与配置版本不一致。' } });
      const validation = await service.validate(config, typeof body.checksum === 'string' ? body.checksum : undefined);
      if (validation.issues.length) return json(422, { checksum: validation.checksum, issues: validation.issues });
      return metadataResponse(await service.replaceDraft(config, validation.checksum, body.revision, actor));
    }
    const actionMatch = /^\/api\/admin\/v1\/configs\/([A-Za-z0-9._-]{1,96})\/(publish|activate)$/.exec(request.path);
    if (request.method === 'POST' && actionMatch?.[1] && actionMatch[2]) {
      const body = parseBody(request.bodyText);
      if (actionMatch[2] === 'publish') {
        if (typeof body.revision !== 'number') return json(400, { error: { code: 'INVALID_INPUT', message: '缺少 revision。' } });
        return metadataResponse(await service.publish(actionMatch[1], body.revision, actor));
      }
      return metadataResponse(await service.activate(actionMatch[1], actor));
    }
    const exportMatch = /^\/api\/admin\/v1\/configs\/([A-Za-z0-9._-]{1,96})\/export$/.exec(request.path);
    if (request.method === 'GET' && exportMatch?.[1]) {
      const loaded = await service.getVersion(exportMatch[1]);
      return loaded
        ? json(200, { config: loaded.config, checksum: loaded.metadata.checksum, metadata: loaded.metadata })
        : json(404, { error: { code: 'CONFIG_NOT_FOUND', message: '配置版本不存在。' } });
    }
    return json(404, { error: { code: 'NOT_FOUND', message: '接口不存在。' } });
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && ['EMPTY_BODY', 'INVALID_BODY'].includes(error.message))) {
      return json(400, { error: { code: 'INVALID_INPUT', message: '请求体不是有效 JSON 对象。' } });
    }
    if (error instanceof Error && error.message === 'BODY_TOO_LARGE') {
      return json(413, { error: { code: 'PAYLOAD_TOO_LARGE', message: '配置请求超过 5 MiB。' } });
    }
    return json(503, { error: { code: 'TEMPORARY_UNAVAILABLE', message: '配置服务暂时不可用。' } });
  }
}
