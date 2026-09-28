import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ConfigService, DynamoS3ConfigStore } from './config-store.js';
import { routePublicConfig } from './config-http.js';

const tableName = process.env.CONFIG_TABLE_NAME;
const bucketName = process.env.CONFIG_BUCKET_NAME;
if (!tableName || !bucketName) throw new Error('CONFIG_TABLE_NAME and CONFIG_BUCKET_NAME are required.');
const service = new ConfigService(new DynamoS3ConfigStore(new DynamoDBClient({}), tableName, bucketName));

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  const result = await routePublicConfig(service, {
    method,
    path: event.rawPath,
  }, {
    enabled: process.env.ADMIN_AUTH_ENABLED === 'true',
    ...(process.env.ADMIN_ISSUER ? { issuer: process.env.ADMIN_ISSUER } : {}),
    ...(process.env.ADMIN_CLIENT_ID ? { clientId: process.env.ADMIN_CLIENT_ID } : {}),
    ...(process.env.ADMIN_AUTHORIZATION_ENDPOINT ? { authorizationEndpoint: process.env.ADMIN_AUTHORIZATION_ENDPOINT } : {}),
    ...(process.env.ADMIN_TOKEN_ENDPOINT ? { tokenEndpoint: process.env.ADMIN_TOKEN_ENDPOINT } : {}),
    ...(process.env.ADMIN_REDIRECT_URI ? { redirectUri: process.env.ADMIN_REDIRECT_URI } : {}),
    scope: 'openid config/write',
  });
  return { statusCode: result.statusCode, headers: result.headers, body: result.body };
};

