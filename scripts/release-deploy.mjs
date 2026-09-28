import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const profile = valueAfter('--profile');
const authorizedAccount = valueAfter('--authorized-account');
const region = valueAfter('--region') ?? 'ap-northeast-1';
const stage = valueAfter('--stage') ?? 'prod';
const adminCallbackUrl = valueAfter('--admin-callback-url');
const authorizationPhrase = valueAfter('--authorization-text');
const expectedPhrase = 'I authorize this AWS deployment';

const callbackIsValid = (() => {
  try {
    const url = new globalThis.URL(adminCallbackUrl ?? '');
    return url.protocol === 'https:' && url.hostname !== 'localhost.invalid' && !url.hash &&
      (url.pathname === '/' || url.pathname === '/index.html');
  } catch {
    return false;
  }
})();

if (!profile || !authorizedAccount || !callbackIsValid || authorizationPhrase !== expectedPhrase || !args.includes('--i-authorize-aws-changes')) {
  process.stderr.write(`发布被护栏阻止。需要由用户在本次发布中明确提供：
  --profile <name>
  --authorized-account <12位账号>
  --admin-callback-url <真实HTTPS站点根地址或/index.html，不含#片段>
  --i-authorize-aws-changes
  --authorization-text "${expectedPhrase}"
可选：--region ap-northeast-1 --stage prod --bootstrap
这些参数代表会创建/更新可能产生费用的 AWS 资源。\n`);
  process.exit(2);
}

const run = (command, commandArgs, env = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command === pnpmCommand,
    env: { ...process.env, ...env },
  });
  if (result.error) {
    process.stderr.write(`无法启动命令 ${command}：${result.error.message}\n`);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const output = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout.trim();
};

const identity = JSON.parse(output('aws', ['sts', 'get-caller-identity', '--profile', profile, '--region', region, '--output', 'json']));
if (identity.Account !== authorizedAccount) {
  process.stderr.write(`账号不匹配：已授权 ${authorizedAccount}，当前 profile 指向 ${identity.Account}。\n`);
  process.exit(2);
}

const env = {
  AWS_PROFILE: profile,
  AWS_REGION: region,
  AWS_ACCOUNT_ID: authorizedAccount,
  APP_STAGE: stage,
  ADMIN_CALLBACK_URL: adminCallbackUrl,
};
run(pnpmCommand, ['verify'], env);
run(pnpmCommand, ['infra:synth'], env);
run(pnpmCommand, ['infra:diff'], env);
if (args.includes('--bootstrap')) {
  run(pnpmCommand, ['--filter', '@tls/infra', 'exec', 'cdk', 'bootstrap', `aws://${authorizedAccount}/${region}`], env);
}
run(pnpmCommand, ['--filter', '@tls/infra', 'exec', 'cdk', 'deploy', '--all', '--require-approval', 'never'], env);

const stackName = `Tls-${stage}-App`;
const outputs = JSON.parse(
  output('aws', [
    'cloudformation',
    'describe-stacks',
    '--stack-name',
    stackName,
    '--profile',
    profile,
    '--region',
    region,
    '--query',
    'Stacks[0].Outputs',
    '--output',
    'json',
  ]),
);
const findOutput = (key) => outputs.find((entry) => entry.OutputKey === key)?.OutputValue;
const bucket = findOutput('StaticBucketName');
const distributionId = findOutput('DistributionId');
const siteUrl = findOutput('SiteUrl');
if (!bucket || !distributionId) {
  process.stderr.write('部署完成，但无法解析静态桶或 CloudFront 输出；未上传前端。\n');
  process.exit(1);
}

run('aws', ['s3', 'sync', 'apps/web/dist/assets', `s3://${bucket}/assets`, '--cache-control', 'public,max-age=31536000,immutable', '--profile', profile, '--region', region], env);
run('aws', ['s3', 'cp', 'apps/web/dist/index.html', `s3://${bucket}/index.html`, '--cache-control', 'no-cache,max-age=0,must-revalidate', '--content-type', 'text/html; charset=utf-8', '--profile', profile, '--region', region], env);
run('aws', ['cloudfront', 'create-invalidation', '--distribution-id', distributionId, '--paths', '/index.html', '--profile', profile], env);
process.stdout.write(`部署与静态上传完成：${siteUrl}\n请在日本网络的 PC 与实际手机完成手工冒烟。\n`);
