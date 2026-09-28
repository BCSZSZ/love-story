import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoRecordRepository } from './repository.js';
import { RecordService } from './service.js';
import { routeRequest } from './http.js';
import { DynamoS3ConfigStore } from './config-store.js';

const tableName = process.env.RECORDS_TABLE_NAME;
const configTableName = process.env.CONFIG_TABLE_NAME;
const configBucketName = process.env.CONFIG_BUCKET_NAME;
if (!tableName || !configTableName || !configBucketName) throw new Error('Record and config storage environment is required.');
const dynamo = new DynamoDBClient({});
const service = new RecordService(
  new DynamoRecordRepository(dynamo, tableName),
  () => new Date(),
  new DynamoS3ConfigStore(dynamo, configTableName, configBucketName),
);

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const started = performance.now();
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const bodyText = event.isBase64Encoded && event.body ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const result = await routeRequest(
    service,
    {
      method,
      path,
      ...(event.headers.authorization ? { authorization: event.headers.authorization } : {}),
      ...(bodyText !== undefined ? { bodyText } : {}),
    },
    process.env.UPLOAD_ENABLED !== 'false',
  );
  console.info(
    JSON.stringify({
      requestId: context.awsRequestId,
      routeKey: `${method} ${path.replace(/[0-9a-f-]{36}/i, ':recordId')}`,
      statusCode: result.statusCode,
      durationMs: Math.round(performance.now() - started),
      ...(result.errorCode ? { errorType: result.errorCode } : {}),
    }),
  );
  return {
    statusCode: result.statusCode,
    headers: result.headers,
    body: result.body,
  };
};
