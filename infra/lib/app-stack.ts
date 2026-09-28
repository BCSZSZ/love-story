import { Duration, Fn, RemovalPolicy, Stack, type StackProps, CfnOutput } from 'aws-cdk-lib';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket, BucketEncryption, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { HttpApi, HttpMethod, CfnRoute, CfnStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import {
  AccountRecovery,
  CfnUserPoolGroup,
  Mfa,
  OAuthScope,
  ResourceServerScope,
  UserPool,
  UserPoolClientIdentityProvider,
} from 'aws-cdk-lib/aws-cognito';
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import { resolve } from 'node:path';

interface AppStackProps extends StackProps {
  stage: string;
  recordsTable: ITable;
  configTable: ITable;
  configBucket: IBucket;
  adminCallbackUrl: string;
  budgetAlertEmail?: string;
}

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const staticBucket = new Bucket(this, 'StaticBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: props.stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: false,
    });

    const userPool = new UserPool(this, 'AdminUserPool', {
      userPoolName: `tls-${props.stage}-config-admins`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      mfa: Mfa.OFF,
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 14,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(7),
      },
      deletionProtection: props.stage === 'prod',
      removalPolicy: RemovalPolicy.RETAIN,
    });
    new CfnUserPoolGroup(this, 'ConfigAdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'config-admin',
      description: 'Can validate, draft, publish, and activate configuration bundles.',
    });
    const writeScope = new ResourceServerScope({ scopeName: 'write', scopeDescription: 'Write configuration bundles' });
    const resourceServer = userPool.addResourceServer('ConfigResourceServer', {
      identifier: 'config',
      scopes: [writeScope],
    });
    const userPoolClient = userPool.addClient('AdminWebClient', {
      userPoolClientName: `tls-${props.stage}-admin-web`,
      generateSecret: false,
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(1),
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.OPENID, OAuthScope.resourceServer(resourceServer, writeScope)],
        callbackUrls: [props.adminCallbackUrl, 'http://127.0.0.1:5173/'],
        logoutUrls: [props.adminCallbackUrl, 'http://127.0.0.1:5173/'],
      },
    });
    const userPoolDomain = userPool.addDomain('AdminHostedDomain', {
      cognitoDomain: { domainPrefix: `tls-${props.stage}-${this.account}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63) },
    });

    const lambdaLogGroup = new LogGroup(this, 'ApiFunctionLogs', {
      logGroupName: `/aws/lambda/tls-${props.stage}-api`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const apiRole = new Role(this, 'ApiFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: 'Least-privilege role for the Tokyo Love Story record API.',
    });
    apiRole.addToPolicy(
      new PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [`${lambdaLogGroup.logGroupArn}:*`],
      }),
    );

    const apiFunction = new NodejsFunction(this, 'ApiFunction', {
      functionName: `tls-${props.stage}-api`,
      entry: resolve(import.meta.dirname, '../../apps/api/src/lambda.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(5),
      reservedConcurrentExecutions: 5,
      logGroup: lambdaLogGroup,
      role: apiRole,
      environment: {
        RECORDS_TABLE_NAME: props.recordsTable.tableName,
        CONFIG_TABLE_NAME: props.configTable.tableName,
        CONFIG_BUCKET_NAME: props.configBucket.bucketName,
        UPLOAD_ENABLED: 'true',
      },
      bundling: {
        format: OutputFormat.ESM,
        target: 'node24',
        minify: true,
        sourceMap: false,
        // Single quotes survive the Windows esbuild command-line invocation;
        // double quotes were stripped and produced `from module` in the bundle.
        banner: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
    });

    apiFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
        resources: [props.recordsTable.tableArn],
      }),
    );
    apiFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:GetItem'],
        resources: [props.configTable.tableArn],
      }),
    );
    apiFunction.addToRolePolicy(
      new PolicyStatement({ effect: Effect.ALLOW, actions: ['s3:GetObject'], resources: [`${props.configBucket.bucketArn}/*`] }),
    );

    const publicConfigLogGroup = new LogGroup(this, 'PublicConfigFunctionLogs', {
      logGroupName: `/aws/lambda/tls-${props.stage}-public-config`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const publicConfigRole = new Role(this, 'PublicConfigFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: 'Read-only access to published configuration; no anonymous-record access.',
    });
    publicConfigRole.addToPolicy(new PolicyStatement({ actions: ['logs:CreateLogStream', 'logs:PutLogEvents'], resources: [`${publicConfigLogGroup.logGroupArn}:*`] }));
    publicConfigRole.addToPolicy(new PolicyStatement({ actions: ['dynamodb:GetItem'], resources: [props.configTable.tableArn] }));
    publicConfigRole.addToPolicy(new PolicyStatement({ actions: ['s3:GetObject'], resources: [`${props.configBucket.bucketArn}/*`] }));
    const publicConfigFunction = new NodejsFunction(this, 'PublicConfigFunction', {
      functionName: `tls-${props.stage}-public-config`,
      entry: resolve(import.meta.dirname, '../../apps/api/src/public-config-lambda.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(5),
      reservedConcurrentExecutions: 5,
      logGroup: publicConfigLogGroup,
      role: publicConfigRole,
      environment: {
        CONFIG_TABLE_NAME: props.configTable.tableName,
        CONFIG_BUCKET_NAME: props.configBucket.bucketName,
        ADMIN_AUTH_ENABLED: 'true',
        ADMIN_ISSUER: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
        ADMIN_CLIENT_ID: userPoolClient.userPoolClientId,
        ADMIN_AUTHORIZATION_ENDPOINT: `${userPoolDomain.baseUrl()}/oauth2/authorize`,
        ADMIN_TOKEN_ENDPOINT: `${userPoolDomain.baseUrl()}/oauth2/token`,
        ADMIN_REDIRECT_URI: props.adminCallbackUrl,
      },
      bundling: {
        format: OutputFormat.ESM,
        target: 'node24',
        minify: true,
        sourceMap: false,
        banner: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
    });

    const adminConfigLogGroup = new LogGroup(this, 'AdminConfigFunctionLogs', {
      logGroupName: `/aws/lambda/tls-${props.stage}-admin-config`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const adminConfigRole = new Role(this, 'AdminConfigFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: 'Configuration-only write access; deliberately excludes the anonymous records table.',
    });
    adminConfigRole.addToPolicy(new PolicyStatement({ actions: ['logs:CreateLogStream', 'logs:PutLogEvents'], resources: [`${adminConfigLogGroup.logGroupArn}:*`] }));
    adminConfigRole.addToPolicy(new PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Scan', 'dynamodb:TransactWriteItems'],
      resources: [props.configTable.tableArn],
    }));
    adminConfigRole.addToPolicy(new PolicyStatement({ actions: ['s3:GetObject', 's3:PutObject'], resources: [`${props.configBucket.bucketArn}/*`] }));
    const adminConfigFunction = new NodejsFunction(this, 'AdminConfigFunction', {
      functionName: `tls-${props.stage}-admin-config`,
      entry: resolve(import.meta.dirname, '../../apps/api/src/admin-config-lambda.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      reservedConcurrentExecutions: 2,
      logGroup: adminConfigLogGroup,
      role: adminConfigRole,
      environment: { CONFIG_TABLE_NAME: props.configTable.tableName, CONFIG_BUCKET_NAME: props.configBucket.bucketName },
      bundling: {
        format: OutputFormat.ESM,
        target: 'node24',
        minify: true,
        sourceMap: false,
        banner: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
    });

    const api = new HttpApi(this, 'HttpApi', {
      apiName: `tls-${props.stage}-http`,
      createDefaultStage: true,
    });
    const integration = new HttpLambdaIntegration('RecordIntegration', apiFunction);
    api.addRoutes({ path: '/api/health', methods: [HttpMethod.GET], integration });
    const postRecordRoute = api.addRoutes({ path: '/api/v1/records', methods: [HttpMethod.POST], integration })[0];
    if (!postRecordRoute) throw new Error('POST record route was not created');
    api.addRoutes({
      path: '/api/v1/records/{recordId}',
      methods: [HttpMethod.PUT, HttpMethod.DELETE],
      integration,
    });
    const publicConfigIntegration = new HttpLambdaIntegration('PublicConfigIntegration', publicConfigFunction);
    api.addRoutes({ path: '/api/v2/config/active', methods: [HttpMethod.GET], integration: publicConfigIntegration });
    api.addRoutes({ path: '/api/v2/config/admin-auth', methods: [HttpMethod.GET], integration: publicConfigIntegration });
    api.addRoutes({ path: '/api/v2/config/{bundleVersion}', methods: [HttpMethod.GET], integration: publicConfigIntegration });

    const adminAuthorizer = new HttpJwtAuthorizer(
      'AdminJwtAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );
    const adminIntegration = new HttpLambdaIntegration('AdminConfigIntegration', adminConfigFunction);
    const adminRoute = (path: string, methods: HttpMethod[]) => api.addRoutes({
      path,
      methods,
      integration: adminIntegration,
      authorizer: adminAuthorizer,
      authorizationScopes: ['config/write'],
    });
    adminRoute('/api/admin/v1/configs', [HttpMethod.GET, HttpMethod.POST]);
    adminRoute('/api/admin/v1/configs/validate', [HttpMethod.POST]);
    adminRoute('/api/admin/v1/configs/{version}', [HttpMethod.PUT]);
    adminRoute('/api/admin/v1/configs/{version}/publish', [HttpMethod.POST]);
    adminRoute('/api/admin/v1/configs/{version}/activate', [HttpMethod.POST]);
    adminRoute('/api/admin/v1/configs/{version}/export', [HttpMethod.GET]);

    const apiLogGroup = new LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/apigateway/tls-${props.stage}-http`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const defaultStage = api.defaultStage?.node.defaultChild as CfnStage;
    defaultStage.addResourceDependency(postRecordRoute.node.defaultChild as CfnRoute);
    defaultStage.defaultRouteSettings = { throttlingBurstLimit: 20, throttlingRateLimit: 10 };
    // RouteSettings is a map, so CDK cannot translate nested property names to
    // CloudFormation's PascalCase representation. Use an override to emit the
    // exact wire shape expected by the API Gateway v2 resource provider.
    defaultStage.addPropertyOverride('RouteSettings', {
      'POST /api/v1/records': { ThrottlingBurstLimit: 5, ThrottlingRateLimit: 2 },
    });
    defaultStage.accessLogSettings = {
      destinationArn: apiLogGroup.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        routeKey: '$context.routeKey',
        status: '$context.status',
        responseLatency: '$context.responseLatency',
        integrationError: '$context.integrationErrorMessage',
      }),
    };
    const responseHeaders = new ResponseHeadersPolicy(this, 'SecurityResponseHeaders', {
      responseHeadersPolicyName: `tls-${props.stage}-security`,
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy:
            `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ${userPoolDomain.baseUrl()}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: HeadersReferrerPolicy.NO_REFERRER, override: true },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
      },
    });

    const staticOrigin = S3BucketOrigin.withOriginAccessControl(staticBucket);
    const noCache = new CachePolicy(this, 'HtmlCachePolicy', {
      cachePolicyName: `tls-${props.stage}-html-no-cache`,
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.seconds(0),
      maxTtl: Duration.minutes(5),
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
    });
    const configCache = new CachePolicy(this, 'PublicConfigCachePolicy', {
      cachePolicyName: `tls-${props.stage}-public-config`,
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.minutes(1),
      maxTtl: Duration.days(365),
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
    });
    const apiDomain = Fn.select(2, Fn.split('/', api.apiEndpoint));
    const distribution = new Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      priceClass: PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: staticOrigin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: noCache,
        responseHeadersPolicy: responseHeaders,
      },
      additionalBehaviors: {
        '/assets/*': {
          origin: staticOrigin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: responseHeaders,
        },
        '/api/v2/config/*': {
          origin: new HttpOrigin(apiDomain),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: configCache,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: responseHeaders,
        },
        '/api/*': {
          origin: new HttpOrigin(apiDomain),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: responseHeaders,
        },
      },
    });

    new Alarm(this, 'LambdaErrorsAlarm', {
      alarmName: `tls-${props.stage}-lambda-errors`,
      metric: apiFunction.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    new Alarm(this, 'Api5xxAlarm', {
      alarmName: `tls-${props.stage}-api-5xx`,
      metric: new Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5xx',
        dimensionsMap: { ApiId: api.apiId },
        statistic: 'Sum',
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    if (props.budgetAlertEmail) {
      new CfnBudget(this, 'BudgetAlerts', {
        budget: {
          budgetName: `tls-${props.stage}-monthly`,
          budgetLimit: { amount: 20, unit: 'USD' },
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
        },
        notificationsWithSubscribers: [5, 10, 20].map((threshold) => ({
          notification: {
            comparisonOperator: 'GREATER_THAN',
            notificationType: 'ACTUAL',
            threshold,
            thresholdType: 'ABSOLUTE_VALUE',
          },
          subscribers: [{ address: props.budgetAlertEmail!, subscriptionType: 'EMAIL' }],
        })),
      });
    }

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'StaticBucketName', { value: staticBucket.bucketName });
    new CfnOutput(this, 'ApiEndpoint', { value: api.apiEndpoint });
    new CfnOutput(this, 'AdminUserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'AdminUserPoolClientId', { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, 'AdminHostedLoginBaseUrl', { value: userPoolDomain.baseUrl() });
    new CfnOutput(this, 'AdminCallbackUrl', { value: props.adminCallbackUrl });
  }
}
