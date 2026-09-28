# 东京·爱情故事｜Agent 项目入口

版本 2.0｜2026-09-28。初始化后每次先读 `AGENTS.md` 与 `CONTEXT.md`，再按任务读取一至三个相关规格；不要反复载入整个历史归档或字段 JSON。

## 当前产品基线

这是匿名择偶条件演示估算器，不是实际相亲服务。普通用户不登录：先选择一个真实匹配城市（默认东京），再填写初始 62 个动态问题。结果同时展示“同城条件池”和“圈层内预计可触达”；五档约束强度按 `e = 1 - s × (1 - p)` 放松排除强度，不改写年龄端点或选项。圈层助力以基础圈层为基数相加。

只有管理员登录配置后台。生产身份方案为 Cognito Authorization Code + PKCE、受控邀请、自助注册关闭、MFA OFF。管理员可管理问题/选项、演示比例、评分、城市、圈层、助力和五档，并通过 `.xlsx` 导入导出；已发布定义只能 retired，未发布定义才可物理删除。普通用户记录与管理员配置权限隔离。

所有数字必须标识为演示配置，不声称真实统计，不羞辱用户，不人为调零。自身和对方使用同一个评分函数，分数与人数独立；未来双向接受度仍为 `not_implemented`。

## 技术与导航

React + TypeScript + Vite；共享纯 TS 引擎；Node.js 24 Lambda；DynamoDB；私有 S3 + CloudFront OAC；CDK TypeScript；主区域设计为 `ap-northeast-1`。

| 任务 | 首选资料 |
|---|---|
| 当前状态与真实验证 | `CONTEXT.md` |
| 第一轮确认范围 | `docs/10-first-round-change-spec.md` |
| 产品与交互 | `docs/01-product.md`、`docs/02-ux.md` |
| 动态问题与公式 | `docs/03-fields.md`、`docs/04-model.md` |
| API、Excel、隐私 | `docs/05-data-api.md` |
| Cognito、AWS、发布边界 | `docs/06-aws.md` |
| 阶段、验收 | `docs/07-plan.md`、`docs/08-acceptance.md` |
| 决策来源 | `docs/09-sources-decisions.md` |
| v1 历史资料 | `docs/archive/`，只在追溯时读取 |

## 执行边界

按 `docs/07-plan.md` 连续推进本地实现与验证，不因缺 AWS 账号停止可离线工作。复杂变更先记录简短计划，业务口径改变同步文档。使用 `pnpm verify`、`pnpm test:smoke` 与 `pnpm infra:synth` 区分实现、mock、合成和线上验证。

默认禁止 commit、push、切分支、AWS bootstrap/deploy、创建付费资源、发布公网、删除云数据或修改 DNS；只有用户针对当次动作的明确授权才能覆盖。Git 推送授权不包含 AWS 部署授权。收尾更新 `CONTEXT.md`，如实记录命令、结果、未做事项和阻塞。

