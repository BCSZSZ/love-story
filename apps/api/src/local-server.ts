import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { FileRecordRepository } from './repository.js';
import { RecordService } from './service.js';
import { routeRequest } from './http.js';
import { ConfigService, MemoryConfigStore } from './config-store.js';
import { routeAdminConfig, routePublicConfig } from './config-http.js';

const host = '127.0.0.1';
const port = Number(process.env.API_PORT ?? 8787);
const repository = await FileRecordRepository.open(resolve(process.cwd(), '../../.local-data/records.json'));
const configStore = new MemoryConfigStore();
const service = new RecordService(repository, () => new Date(), configStore);
const configService = new ConfigService(configStore);

const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size <= 1_048_576) chunks.push(buffer);
  }
  const started = performance.now();
  const path = new URL(request.url ?? '/', `http://${host}`).pathname;
  const httpRequest = {
    method: request.method ?? 'GET',
    path,
    ...(request.headers.authorization ? { authorization: request.headers.authorization } : {}),
    bodyText: size > 1_048_576 ? ' '.repeat(1_048_577) : Buffer.concat(chunks).toString('utf8'),
  };
  const result = path.startsWith('/api/admin/')
    ? await routeAdminConfig(configService, httpRequest, 'local-config-admin')
    : path.startsWith('/api/v2/config/')
      ? await routePublicConfig(configService, httpRequest, { enabled: false })
      : await routeRequest(service, httpRequest);
  response.writeHead(result.statusCode, result.headers);
  response.end(result.body);
  console.info(
    JSON.stringify({
      routeKey: `${request.method ?? 'GET'} ${path.replace(/[0-9a-f-]{36}/i, ':recordId')}`,
      statusCode: result.statusCode,
      durationMs: Math.round(performance.now() - started),
      ...(result.errorCode ? { errorType: result.errorCode } : {}),
    }),
  );
});

server.listen(port, host, () => {
  console.info(`Local API listening on http://${host}:${port}`);
});
