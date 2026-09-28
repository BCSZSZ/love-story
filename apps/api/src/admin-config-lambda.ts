import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { ConfigService, DynamoS3ConfigStore } from './config-store.js';
import { routeAdminConfig } from './config-http.js';

const tableName = process.env.CONFIG_TABLE_NAME;
const bucketName = process.env.CONFIG_BUCKET_NAME;
if (!tableName || !bucketName) throw new Error('CONFIG_TABLE_NAME and CONFIG_BUCKET_NAME are required.');
const service = new ConfigService(new DynamoS3ConfigStore(new DynamoDBClient({}), tableName, bucketName));

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const scope = typeof claims?.scope === 'string' ? claims.scope.split(' ') : [];
  const rawGroups = claims?.['cognito:groups'];
  const groups = Array.isArray(rawGroups)
    ? rawGroups.map(String)
    : typeof rawGroups === 'string'
      ? rawGroups.replace(/^\[|\]$/g, '').split(',').map((value) => value.trim())
      : [];
  const subject = typeof claims?.sub === 'string' ? claims.sub : undefined;
  if (!subject || !scope.includes('config/write') || !groups.includes('config-admin')) {
    return {
      statusCode: 403,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      body: JSON.stringify({ error: { code: 'ADMIN_FORBIDDEN', message: '管理员权限不足。' } }),
    };
  }
  const bodyText = event.isBase64Encoded && event.body ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const result = await routeAdminConfig(service, {
    method: event.requestContext.http.method,
    path: event.rawPath,
    ...(bodyText !== undefined ? { bodyText } : {}),
  }, subject);
  return { statusCode: result.statusCode, headers: result.headers, body: result.body };
};
