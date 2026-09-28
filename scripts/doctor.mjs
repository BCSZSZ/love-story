import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const checks = [];

function check(name, passed, detail) {
  checks.push({ name, passed, detail });
  process.stdout.write(`${passed ? '✓' : '✗'} ${name}: ${detail}\n`);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
check('Node.js', nodeMajor === 24, `${process.versions.node}（项目要求 24.x；Lambda 目标运行时为 nodejs24.x）`);

let pnpmVersion = /pnpm\/([^\s]+)/.exec(process.env.npm_config_user_agent ?? '')?.[1] ?? '不可用';
if (pnpmVersion === '不可用') {
  try {
    pnpmVersion = execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    // Reported as an unavailable version below.
  }
}
check('pnpm', pnpmVersion.startsWith('11.'), pnpmVersion);

for (const path of [
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'apps/web/package.json',
  'apps/api/package.json',
  'packages/domain/package.json',
  'packages/engine/package.json',
  'packages/model-config/package.json',
  'packages/config-workbook/package.json',
  'infra/package.json',
]) {
  check(path, existsSync(resolve(root, path)), existsSync(resolve(root, path)) ? '存在' : '缺失');
}

try {
  const catalog = JSON.parse(readFileSync(resolve(root, 'config/catalog.demo.v1.json'), 'utf8'));
  const model = JSON.parse(readFileSync(resolve(root, 'config/model.demo.v1.json'), 'utf8'));
  const runtime = JSON.parse(readFileSync(resolve(root, 'config/runtime.demo.v2.json'), 'utf8'));
  const legacyIds = new Set(catalog.fields.map((field) => field.id));
  const v2Ids = new Set(catalog.fields.filter((field) => field.id !== 'residence').map((field) => field.id));
  check('v1 历史目录', catalog.fields.length === 63 && legacyIds.size === 63, `${catalog.fields.length} 个字段，${legacyIds.size} 个唯一 ID`);
  check(
    'v2 问题目录',
    v2Ids.size === 62 && !v2Ids.has('residence'),
    `${v2Ids.size} 个问题，residence 已迁移为顶层匹配城市`,
  );
  check(
    'v2 模型覆盖',
    Object.keys(model.fields).filter((id) => id !== 'residence').length === 62 && [...v2Ids].every((id) => model.fields[id]),
    `${Object.keys(model.fields).filter((id) => id !== 'residence').length} 个模型问题`,
  );
  check(
    'v2 运行时种子',
    runtime.schemaVersion === '2.0.0' && runtime.cities.length === 4 && runtime.reachTiers.length === 3 &&
      runtime.reachBoosts.length === 3 && runtime.strictnessLevels.length === 5 && runtime.defaultCityId === 'jp_tokyo',
    `${runtime.cities.length} 城市 / ${runtime.reachTiers.length} 圈层 / ${runtime.reachBoosts.length} 助力 / ${runtime.strictnessLevels.length} 强度档`,
  );
} catch (error) {
  check('配置读取', false, error instanceof Error ? error.message : String(error));
}

const profile = process.env.AWS_PROFILE;
check('AWS 部署身份', Boolean(profile), profile ? `已选择 profile ${profile}（doctor 不访问云端）` : '未选择；本地 P0–P5 不受影响');
check('AWS 区域', (process.env.AWS_REGION ?? 'ap-northeast-1') === 'ap-northeast-1', process.env.AWS_REGION ?? 'ap-northeast-1（默认）');

const failures = checks.filter((entry) => !entry.passed && !['AWS 部署身份'].includes(entry.name));
process.stdout.write(`\n${failures.length ? `发现 ${failures.length} 个需要处理的条件。` : '本地开发条件就绪。'}\n`);
process.exitCode = failures.length ? 1 : 0;
