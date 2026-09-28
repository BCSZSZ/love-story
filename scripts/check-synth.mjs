import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const directory = resolve(process.cwd(), process.argv[2] ?? 'cdk.out');
const templates = readdirSync(directory)
  .filter((name) => name.endsWith('.template.json'))
  .map((name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8')));
const resources = templates.flatMap((template) => Object.entries(template.Resources ?? {}).map(([logicalId, resource]) => ({ logicalId, ...resource })));
const byType = (type) => resources.filter((resource) => resource.Type === type);
const assert = (condition, message) => { if (!condition) throw new Error(`Synth check failed: ${message}`); };

assert(templates.length === 2, `expected two stack templates, found ${templates.length}`);
const assetManifests = readdirSync(directory)
  .filter((name) => name.endsWith('.assets.json'))
  .map((name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8')));
const lambdaEntryPoints = assetManifests.flatMap((manifest) => Object.values(manifest.files ?? {})
  .filter((asset) => asset.displayName?.endsWith('/Code') && asset.source?.packaging === 'zip')
  .map((asset) => resolve(directory, asset.source.path, 'index.mjs'))
  .filter(existsSync));
assert(lambdaEntryPoints.length === 3, `expected three isolated Lambda entry points, found ${lambdaEntryPoints.length}`);
for (const entryPoint of lambdaEntryPoints) {
  const syntaxCheck = spawnSync(process.execPath, ['--check', entryPoint], { encoding: 'utf8' });
  assert(syntaxCheck.status === 0, `Lambda bundle has invalid syntax: ${(syntaxCheck.stderr || syntaxCheck.stdout).trim()}`);
}

const forbidden = [
  'AWS::EC2::VPC', 'AWS::EC2::NatGateway', 'AWS::EC2::Instance', 'AWS::RDS::', 'AWS::Bedrock::',
  'AWS::ECS::', 'AWS::OpenSearchService::', 'AWS::ElasticLoadBalancingV2::',
];
for (const resource of resources) {
  assert(!forbidden.some((type) => resource.Type === type || resource.Type.startsWith(type)), `forbidden resource ${resource.Type}`);
}

const tables = byType('AWS::DynamoDB::Table');
assert(tables.length === 2, `expected records and config tables, found ${tables.length}`);
const recordsTable = tables.find((table) => table.Properties.KeySchema?.[0]?.AttributeName === 'recordId');
const configTable = tables.find((table) => table.Properties.KeySchema?.[0]?.AttributeName === 'configKey');
assert(recordsTable && configTable, 'records/config tables must use distinct partition keys');
for (const table of tables) {
  assert(table.Properties.BillingMode === 'PAY_PER_REQUEST', `${table.logicalId} must use on-demand billing`);
  assert(table.Properties.DeletionProtectionEnabled === true, `${table.logicalId} production deletion protection is required`);
  assert(table.DeletionPolicy === 'Retain' && table.UpdateReplacePolicy === 'Retain', `${table.logicalId} must be retained`);
}
assert(recordsTable.Properties.TimeToLiveSpecification?.AttributeName === 'expiresAt', 'records TTL must use expiresAt');
assert(!configTable.Properties.TimeToLiveSpecification, 'configuration versions must not expire via TTL');

const buckets = byType('AWS::S3::Bucket');
assert(buckets.length === 2, `expected static and versioned config buckets, found ${buckets.length}`);
for (const bucket of buckets) {
  const block = bucket.Properties.PublicAccessBlockConfiguration;
  assert(block?.BlockPublicAcls && block.BlockPublicPolicy && block.IgnorePublicAcls && block.RestrictPublicBuckets, `${bucket.logicalId} must block public access`);
}
const configBucket = buckets.find((bucket) => bucket.Properties.VersioningConfiguration?.Status === 'Enabled');
assert(configBucket, 'configuration bucket must have S3 versioning enabled');
assert(configBucket.DeletionPolicy === 'Retain' && configBucket.UpdateReplacePolicy === 'Retain', 'configuration bucket must be retained');
assert(byType('AWS::CloudFront::OriginAccessControl').length === 1, 'CloudFront OAC is required only for the static bucket');

const [userPool] = byType('AWS::Cognito::UserPool');
const [userPoolClient] = byType('AWS::Cognito::UserPoolClient');
assert(userPool && userPoolClient, 'administrator Cognito user pool and web client are required');
assert(userPool.Properties.AdminCreateUserConfig?.AllowAdminCreateUserOnly === true, 'Cognito self-registration must be disabled');
assert(userPool.Properties.MfaConfiguration === 'OFF', 'first-round administrator MFA must remain off');
assert(userPool.Properties.Policies?.PasswordPolicy?.MinimumLength >= 14, 'administrator password policy is too weak');
assert(userPoolClient.Properties.GenerateSecret === false, 'browser PKCE client cannot have a client secret');
assert(userPoolClient.Properties.AllowedOAuthFlows?.includes('code'), 'authorization code flow is required');
assert(!userPoolClient.Properties.AllowedOAuthFlows?.includes('implicit'), 'implicit OAuth flow must not be enabled');
assert(byType('AWS::Cognito::UserPoolGroup').some((group) => group.Properties.GroupName === 'config-admin'), 'config-admin group is required');
const [authorizer] = byType('AWS::ApiGatewayV2::Authorizer');
assert(authorizer?.Properties.AuthorizerType === 'JWT', 'administrator API requires an API Gateway JWT authorizer');

const lambdas = byType('AWS::Lambda::Function');
assert(lambdas.length === 3, `expected three Lambdas, found ${lambdas.length}`);
for (const lambda of lambdas) {
  assert(lambda.Properties.Runtime === 'nodejs24.x', `${lambda.Properties.FunctionName} must target Node.js 24`);
  assert(lambda.Properties.Architectures?.[0] === 'arm64', `${lambda.Properties.FunctionName} must use ARM64`);
}
const recordLambda = lambdas.find((lambda) => lambda.Properties.FunctionName === 'tls-prod-api');
const publicConfigLambda = lambdas.find((lambda) => lambda.Properties.FunctionName === 'tls-prod-public-config');
const adminConfigLambda = lambdas.find((lambda) => lambda.Properties.FunctionName === 'tls-prod-admin-config');
assert(recordLambda?.Properties.MemorySize === 256 && recordLambda.Properties.Timeout === 5, 'record Lambda size/timeout mismatch');
assert(publicConfigLambda?.Properties.MemorySize === 256 && publicConfigLambda.Properties.Timeout === 5, 'public config Lambda size/timeout mismatch');
assert(adminConfigLambda?.Properties.MemorySize === 512 && adminConfigLambda.Properties.Timeout === 10, 'admin config Lambda size/timeout mismatch');

const routeKeys = new Set(byType('AWS::ApiGatewayV2::Route').map((route) => route.Properties.RouteKey));
for (const expected of [
  'GET /api/health', 'POST /api/v1/records', 'PUT /api/v1/records/{recordId}', 'DELETE /api/v1/records/{recordId}',
  'GET /api/v2/config/active', 'GET /api/v2/config/admin-auth', 'GET /api/v2/config/{bundleVersion}',
  'GET /api/admin/v1/configs', 'POST /api/admin/v1/configs', 'POST /api/admin/v1/configs/validate',
  'PUT /api/admin/v1/configs/{version}', 'POST /api/admin/v1/configs/{version}/publish',
  'POST /api/admin/v1/configs/{version}/activate', 'GET /api/admin/v1/configs/{version}/export',
]) assert(routeKeys.has(expected), `missing API route ${expected}`);
for (const route of byType('AWS::ApiGatewayV2::Route').filter((entry) => entry.Properties.RouteKey.includes('/api/admin/'))) {
  assert(route.Properties.AuthorizationType === 'JWT', `${route.Properties.RouteKey} must require JWT`);
  assert(JSON.stringify(route.Properties.AuthorizationScopes).includes('config/write'), `${route.Properties.RouteKey} must require config/write scope`);
}

const [distribution] = byType('AWS::CloudFront::Distribution');
assert(distribution, 'missing CloudFront distribution');
const behaviors = distribution.Properties.DistributionConfig.CacheBehaviors ?? [];
const apiBehavior = behaviors.find((behavior) => behavior.PathPattern === '/api/*');
const configBehavior = behaviors.find((behavior) => behavior.PathPattern === '/api/v2/config/*');
assert(apiBehavior?.CachePolicyId === '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', 'mutable APIs must use AWS managed caching-disabled policy');
assert(configBehavior && configBehavior.CachePolicyId !== apiBehavior.CachePolicyId, 'versioned public configuration must use its dedicated cache policy');
assert(
  behaviors.findIndex((behavior) => behavior.PathPattern === '/api/v2/config/*') < behaviors.findIndex((behavior) => behavior.PathPattern === '/api/*'),
  'specific public configuration behavior must precede the generic /api/* behavior',
);
assert(apiBehavior?.OriginRequestPolicyId === 'b689b0a8-53d0-40ab-baf2-68738e2966ac', 'API must forward Authorization without viewer Host');

const [apiStage] = byType('AWS::ApiGatewayV2::Stage');
assert(apiStage, 'missing API stage');
const postRouteSettings = apiStage.Properties.RouteSettings?.['POST /api/v1/records'];
assert(postRouteSettings?.ThrottlingBurstLimit === 5 && postRouteSettings?.ThrottlingRateLimit === 2, 'record POST throttling mismatch');
const appTemplate = templates.find((template) => Object.values(template.Resources ?? {}).some((resource) => resource.Type === 'AWS::ApiGatewayV2::Stage'));
const postRouteEntry = Object.entries(appTemplate.Resources).find(([, resource]) => resource.Type === 'AWS::ApiGatewayV2::Route' && resource.Properties.RouteKey === 'POST /api/v1/records');
const stageEntry = Object.entries(appTemplate.Resources).find(([, resource]) => resource.Type === 'AWS::ApiGatewayV2::Stage');
const stageDependencies = Array.isArray(stageEntry?.[1].DependsOn) ? stageEntry[1].DependsOn : stageEntry?.[1].DependsOn ? [stageEntry[1].DependsOn] : [];
assert(postRouteEntry && stageDependencies.includes(postRouteEntry[0]), 'API stage must depend on throttled record POST route');

for (const logGroup of byType('AWS::Logs::LogGroup')) assert(logGroup.Properties.RetentionInDays === 14, 'all logs must retain for 14 days');
const policies = byType('AWS::IAM::Policy');
const recordPolicy = policies.find((policy) => policy.logicalId.startsWith('ApiFunctionRole'));
const publicPolicy = policies.find((policy) => policy.logicalId.startsWith('PublicConfigFunctionRole'));
const adminPolicy = policies.find((policy) => policy.logicalId.startsWith('AdminConfigFunctionRole'));
assert(recordPolicy && publicPolicy && adminPolicy, 'three isolated Lambda policies are required');
const recordPolicyText = JSON.stringify(recordPolicy);
const publicPolicyText = JSON.stringify(publicPolicy);
const adminPolicyText = JSON.stringify(adminPolicy);
assert(!recordPolicyText.includes('dynamodb:Scan') && !recordPolicyText.includes('dynamodb:Query'), 'record API must not Scan or Query');
assert(!publicPolicyText.includes('dynamodb:Scan') && !publicPolicyText.includes('dynamodb:PutItem'), 'public config API must be read-only');
assert(adminPolicyText.includes('dynamodb:Scan') && adminPolicyText.includes('s3:PutObject'), 'admin config API requires config list/write access');
assert(!adminPolicyText.includes('RecordsTable'), 'admin config API must not access anonymous records');

process.stdout.write(JSON.stringify({
  templates: templates.length,
  resources: resources.length,
  routes: routeKeys.size,
  lambdas: lambdas.length,
  isolatedPolicies: true,
  cognitoPkce: true,
  mfa: false,
  configBucketVersioned: true,
  anonymousRecordsUnavailableToAdmin: true,
}, null, 2) + '\n');
