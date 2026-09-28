import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const example = JSON.parse(readFileSync(resolve(root, 'config/deploy.example.json'), 'utf8'));
const profile = process.env.AWS_PROFILE ?? example.aws.profile;
const region = process.env.AWS_REGION ?? example.aws.region;
const stage = process.env.APP_STAGE ?? example.stage;
const adminCallbackUrl = process.env.ADMIN_CALLBACK_URL;
let identity = { Account: '未验证', Arn: '未验证' };
let identityStatus = '缺少 profile；未访问 AWS';

if (profile) {
  const result = spawnSync('aws', ['sts', 'get-caller-identity', '--profile', profile, '--region', region, '--output', 'json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status === 0) {
    identity = JSON.parse(result.stdout);
    identityStatus = '已用 STS 只读验证';
  } else {
    identityStatus = `身份验证失败：${(result.stderr || result.stdout).trim()}`;
  }
}

process.stdout.write(`东京·爱情故事｜发布计划（不写云）

目标
- stage: ${stage}
- region: ${region}
- profile: ${profile ?? '未提供'}
- account: ${identity.Account}
- identity: ${identity.Arn}
- admin callback: ${adminCallbackUrl ?? '未提供（部署会被护栏阻止）'}
- 状态: ${identityStatus}

计划资源
- DynamoDB 按需表：records（TTL）与 config（版本元数据/激活指针），生产删除保护/RETAIN
- 私有版本化配置 S3 桶，以及私有静态 S3 + CloudFront OAC
- Node.js 24 ARM64 三个隔离 Lambda：匿名记录、公共配置、管理配置
- Cognito 管理员 User Pool（邀请制、PKCE、MFA OFF）与 API Gateway JWT authorizer
- API Gateway HTTP API（同源 14 路由、默认 10rps/burst20，记录 POST 2rps/burst5）
- 公共配置专用缓存、其他 API 禁用缓存
- CloudWatch 14天日志、Lambda/API 5xx 告警
- 可选 AWS Budget 邮件告警（仅在 BUDGET_ALERT_EMAIL 提供时）

费用假设（非账单或硬上限）
- 每月 10,000 次测试、每次 12 次保存、平均 16KiB 快照
- 约 1,920,000 WRU、3,000 GB-s、4.88GiB CDN 首载出站
- 建议 US$5 / US$10 / US$20 告警；价格以东京区域和账户实际费率为准

发布前门槛
- Node 24、pnpm verify、pnpm infra:synth 必须通过
- 必须显式提供不含 URL fragment 的真实 HTTPS 站点根 ADMIN_CALLBACK_URL
- cdk diff 必须使用 --no-change-set
- bootstrap、deploy、静态上传、invalidation 都需要本次明确授权
- 本脚本未运行任何创建、更新、删除或发布操作
`);

if (profile && identity.Account !== '未验证') {
  process.stdout.write('\n可继续运行只读差异：AWS_PROFILE=' + profile + ' pnpm infra:diff\n');
}
