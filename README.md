# 东京·爱情故事

面向中文成年用户的匿名择偶条件演示估算器。用户先选择一个真实匹配城市，再以 62 个初始问题估算“同城条件池”和“圈层内预计可触达”两个结果。所有人口比例、评分与社交圈参数都是可管理的演示配置，不是真实人口统计；本项目不是实际相亲服务。

第一轮 v2 已实现并于 2026-09-28 部署到 AWS 东京区域：<https://d2vaw39850chxv.cloudfront.net>。桌面与 390px 移动视口的公网匿名流程已验证；应用管理员邀请已触发，实际手机检查和管理员首次登录仍待完成。

## 本地运行

要求 Node.js 24.x 与 pnpm 11.x。

```powershell
pnpm install
pnpm doctor:project
pnpm dev
```

本机前端监听 `http://127.0.0.1:5173`，API 监听 `http://127.0.0.1:8787`。开发记录写入被 Git 忽略的 `.local-data/`；本机管理后台使用明确标识的开发管理员 adapter，不伪装 Cognito 登录成功。

普通用户保持匿名。生产设计中只有管理员使用 Cognito Authorization Code + PKCE；关闭自助注册和 MFA，并要求 `config-admin` group 与 `config/write` scope。

## 验证命令

```powershell
python scripts/validate_design.py
pnpm doctor:project
pnpm verify
pnpm test:smoke
pnpm infra:synth
pnpm test:smoke:deployed https://d2vaw39850chxv.cloudfront.net
```

- `validate_design.py` 只检查 v1 历史算例与 v2 迁移种子，不代替应用测试。
- `verify` 运行 lint、全仓类型检查、Vitest 与构建。
- `test:smoke` 在桌面 Chromium 和 390px 移动视口验证真实城市、62 问题、双结果、五档强度、圈层助力、PNG、恢复，以及管理员新增问题、保存草稿和 Excel 导出。
- `infra:synth` 只在本机生成 CloudFormation，并检查两张 DynamoDB 表、两个私有 S3 桶、三个隔离 Lambda、14 条路由、Cognito PKCE/MFA OFF、CloudFront 配置缓存、最小 IAM，以及不存在 VPC/NAT/EC2/RDS/Bedrock。
- `test:smoke:deployed` 只能用于已实际部署 v2 的 HTTPS 地址；它会创建并在结束时删除合成匿名记录。

## 工程结构

```text
apps/web/                    动态普通问卷、双结果、PNG 与配置后台
apps/api/                    本机 HTTP、三个 Lambda handler、记录与配置服务
packages/domain/             schema v2、运行时配置和匿名快照契约
packages/model-config/       从历史目录构造并校验 v2 默认配置
packages/engine/             城市、条件强度、评分和圈层的纯 TS 引擎
packages/config-workbook/    安全的 .xlsx 导入、导出与 round-trip
infra/                       CDK DataStack / AppStack
config/                      v1 历史配置、v2 运行时种子和部署示例
docs/                        产品、交互、API、AWS、验收与确认规格
scripts/                     doctor、smoke、synth 检查和受保护发布流程
```

## AWS 与 Git 边界

主区域设计为 `ap-northeast-1`。`pnpm release:plan` 只展示计划；`pnpm infra:diff` 固定使用只读的 `cdk diff --no-change-set`。真实发布还必须单独提供 AWS profile、12 位账户、无 URL fragment 的 HTTPS `ADMIN_CALLBACK_URL`，以及本次部署授权。实现或 Git 推送授权不等于 AWS 部署授权。

本轮已在用户逐次明确授权后完成 SSO 身份核验、无 change-set 的 diff、CDK deploy、静态上传、CloudFront invalidation 和公网冒烟；部署后 diff 为零。Cognito 首个应用管理员已通过受控邀请创建并加入 `config-admin`，当前等待首次登录强制改密。仓库不保存 AWS 密钥、完整管理员邮箱、临时密码、管理员 token 或告警邮箱。

## 资料入口

- 当前状态：`CONTEXT.md`
- 第一轮确认规格：`docs/10-first-round-change-spec.md`
- 实装计划与状态：`docs/11-first-round-implementation-plan.md`
- 产品、公式与验收：`docs/01-product.md`、`docs/04-model.md`、`docs/08-acceptance.md`
- 历史 v1 自包含启动包：`docs/archive/`（只作历史参考）
