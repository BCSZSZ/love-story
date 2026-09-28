# 07｜实施计划与交付关卡

版本：2.0.0 · 本轮详细执行计划见 `docs/11-first-round-implementation-plan.md`。状态以 `CONTEXT.md` 的最近一次真实验证为准。

## 1. 工程结构

```text
apps/web/                 运行时表单、双结果、五档预览、后台、ShareCard
apps/api/                 匿名记录、公共配置、管理配置三个 Lambda 入口及本机适配
packages/domain/          动态字段、schema v2、输入与配置契约
packages/engine/          人数、圈层、同标评分、相邻放松、RuntimeEngine
packages/model-config/    v2 seed、规范化与完整配置校验
packages/config-workbook/ .xlsx 严格导入导出与 round-trip
infra/                    CDK DataStack/AppStack
scripts/                  doctor、verify、synth、diff、release 包装器
config/                   v1 原始配置和 v2 完整运行时 seed
docs/                     产品、模型、API、AWS、验收和决策记录
```

共享引擎不得混入 DOM 或 AWS 依赖。前端、Record 服务和配置服务都通过一个完整 `RuntimeConfigBundle` 工作；配置存储、Excel 和 UI 只围绕这一个深接口转换。

## 2. 第一轮阶段与关卡

| 阶段 | 范围 | 完成关卡 |
|---|---|---|
| R0 规格与迁移 | 确认城市、圈层、强度、后台、Excel、管理员认证和 v1→v2 规则 | 10 为确认版，11 有执行计划；冲突旧规格已同步。 |
| R1 领域与引擎 | 动态 `FieldId`、schema v2、62 问题 seed、城市、五档公式、双结果、评分语义 | 单测覆盖版本、单调性、加法助力、双结果和 0 档评分。 |
| R2 配置工作簿 | 12 个固定 sheet、安全解析、共享校验、规范化 checksum | 导出/导入 round-trip checksum 一致；公式、坏 mass、错误扩展名被拒绝。 |
| R3 配置服务 | ConfigStore、不可变版本、草稿 CAS、发布/激活、公共和管理路由 | API 单测通过；匿名记录按指定版本/checksum 服务端复算。 |
| R4 用户与后台 UI | 动态城市标题、运行时问题、双结果、圈层、五档；PKCE 后台和五个管理区 | PC/手机主流程与后台新增问题/保存/导出 smoke 通过。 |
| R5 IaC | config 表/桶、Cognito、三个 Lambda、JWT route、缓存和隔离 IAM | 离线 synth 断言资源、14 路由、MFA OFF、配置桶 versioning、后台无记录权限。 |
| R6 Git 交付 | 审阅变更、提交、推送 | 必须存在合法仓库和用户指定/已有 remote；不得自行猜 remote。 |
| R7 AWS 上线 | diff、部署、真实 Cognito/配置/匿名流程、现场设备检查 | 需要另行 AWS 部署授权；实现或 push 授权不等于部署授权。 |

R0～R5 应连续推进，不因未提供 AWS 账号停止本地工作。R6 缺少 Git 元数据时报告阻塞，不初始化一个与用户远端无关的新仓库。R7 永远在明确授权后进行。

## 3. 命令契约

| 命令 | 内容 |
|---|---|
| `pnpm doctor` | 检查 Node 24、pnpm、依赖、配置和工作区；不创建云资源。 |
| `pnpm dev` | 本机前端 + API；只绑定 loopback，本机管理员模式。 |
| `pnpm lint` | 全仓静态检查。 |
| `pnpm typecheck` | 全 workspace TypeScript 检查。 |
| `pnpm test` | 引擎、工作簿、记录和配置服务单测。 |
| `pnpm test:smoke` | 桌面/手机用户流程及管理员新增问题、验证、草稿和 Excel 导出。 |
| `pnpm build` | 构建所有包、前端和 Lambda；不部署。 |
| `pnpm verify` | lint + typecheck + test + build。 |
| `pnpm infra:synth` | 离线 CDK synth 和模板/资产断言；不接触 AWS。 |
| `pnpm infra:diff` | 需要显式 AWS profile，先校验身份，再 `cdk diff --no-change-set`。 |
| `pnpm release:plan` | 输出目标、资源、成本假设和验证状态；不写云。 |
| `pnpm release:deploy` | 仅在当前明确部署授权及账户/区域检查通过后执行。 |

## 4. 变更规则

- 业务规则变化同步 01、04 和 10；字段目录变化同步 03；API/存储变化同步 05；云资源同步 06；验收同步 08；决策同步 09。
- 配置内容变化创建新版本，不覆盖 published 正文。
- 不为测试通过而修改正确期望去掩盖算法错误。
- 代码、mock、synth、diff、部署和线上验证分别报告；一个不能替代另一个。
- 修改结束更新 `CONTEXT.md`，列出真实命令、结果、未做事项及 Git/AWS 状态。
