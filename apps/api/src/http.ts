import type { RecordService } from './service.js';
import { ApiError, parseBearer } from './service.js';
import { SUPPORTED_VERSIONS } from '@tls/model-config';

export interface HttpRequest {
  method: string;
  path: string;
  authorization?: string;
  bodyText?: string;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  errorCode?: string;
}

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
};

function json(statusCode: number, value: unknown, errorCode?: string): HttpResponse {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(value),
    ...(errorCode ? { errorCode } : {}),
  };
}

function parseBody(bodyText: string | undefined): unknown {
  if (!bodyText) throw new ApiError('INVALID_INPUT', '请求体不能为空。');
  if (Buffer.byteLength(bodyText, 'utf8') > 65_536) {
    throw new ApiError('PAYLOAD_TOO_LARGE', '请求体超过 64KiB。');
  }
  try {
    return JSON.parse(bodyText);
  } catch {
    throw new ApiError('INVALID_INPUT', '请求体不是有效JSON。');
  }
}

export async function routeRequest(
  service: RecordService,
  request: HttpRequest,
  uploadEnabled = true,
): Promise<HttpResponse> {
  try {
    if (request.method === 'GET' && request.path === '/api/health') {
      return json(200, {
        status: 'ok',
        uploadEnabled,
        versions: {
          catalogVersion: SUPPORTED_VERSIONS.catalogVersion,
          modelVersion: SUPPORTED_VERSIONS.modelVersion,
          fxVersion: SUPPORTED_VERSIONS.fxVersion,
        },
      });
    }
    if (!uploadEnabled) throw new ApiError('TEMPORARY_UNAVAILABLE', '云端上传目前暂停，本机计算仍可使用。');
    if (request.method === 'POST' && request.path === '/api/v1/records') {
      const result = await service.create(parseBody(request.bodyText), parseBearer(request.authorization));
      return json(201, result);
    }
    const match = /^\/api\/v1\/records\/([0-9a-f-]{36})$/i.exec(request.path);
    if (match?.[1] && request.method === 'PUT') {
      const result = await service.replace(
        match[1],
        parseBody(request.bodyText),
        parseBearer(request.authorization),
      );
      return json(200, result);
    }
    if (match?.[1] && request.method === 'DELETE') {
      await service.delete(match[1], parseBearer(request.authorization));
      return { statusCode: 204, headers: HEADERS, body: '' };
    }
    return json(404, { error: { code: 'NOT_FOUND', message: '接口不存在。' } }, 'NOT_FOUND');
  } catch (error) {
    if (error instanceof ApiError) {
      return json(
        error.status,
        { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
        error.code,
      );
    }
    return json(
      503,
      { error: { code: 'TEMPORARY_UNAVAILABLE', message: '服务暂时不可用，请稍后重试。' } },
      'TEMPORARY_UNAVAILABLE',
    );
  }
}
