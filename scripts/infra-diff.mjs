import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = process.argv.slice(2);
const profileArg = args.indexOf('--profile');
const profile = profileArg >= 0 ? args[profileArg + 1] : process.env.AWS_PROFILE;
const region = process.env.AWS_REGION ?? 'ap-northeast-1';

if (!profile) {
  process.stderr.write('缺少 AWS profile。请使用 AWS_PROFILE=<name> pnpm infra:diff，或传入 --profile <name>。\n');
  process.exit(2);
}

const identity = spawnSync('aws', ['sts', 'get-caller-identity', '--profile', profile, '--region', region, '--output', 'json'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (identity.status !== 0) {
  process.stderr.write(`AWS 身份不可用：${identity.stderr.trim() || identity.stdout.trim()}\n`);
  process.exit(identity.status ?? 1);
}
const account = JSON.parse(identity.stdout).Account;
process.stdout.write(`只读 diff 目标：account ${account} / region ${region} / profile ${profile}\n`);
const result = spawnSync(
  pnpmCommand,
  ['--filter', '@tls/infra', 'exec', 'cdk', 'diff', '--no-change-set'],
  {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      AWS_PROFILE: profile,
      AWS_REGION: region,
      AWS_ACCOUNT_ID: account,
    },
  },
);
if (result.error) {
  process.stderr.write(`无法启动 CDK diff：${result.error.message}\n`);
}
process.exit(result.status ?? 1);
