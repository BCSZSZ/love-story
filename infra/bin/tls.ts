#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack.js';
import { AppStack } from '../lib/app-stack.js';

const app = new App();
const stage = app.node.tryGetContext('stage') ?? process.env.APP_STAGE ?? 'prod';
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID ?? '111111111111';
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'ap-northeast-1';
const env = { account, region };

const data = new DataStack(app, `Tls-${stage}-Data`, { env, stage });
const application = new AppStack(app, `Tls-${stage}-App`, {
  env,
  stage,
  recordsTable: data.recordsTable,
  configTable: data.configTable,
  configBucket: data.configBucket,
  adminCallbackUrl: process.env.ADMIN_CALLBACK_URL ?? 'https://localhost.invalid/',
  budgetAlertEmail: process.env.BUDGET_ALERT_EMAIL,
});
application.addStackDependency(data);
