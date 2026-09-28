# 当前项目状态

更新时间：2026-09-28。

## 结论

第一轮确认规格 `docs/10-first-round-change-spec.md` 已完成实装、Git 推送与 AWS `prod / ap-northeast-1` 部署。用户在 Git 交付后另行明确授权 AWS 写操作，SSO 身份已核验为账户 `212984411858` 的 AdministratorAccess 角色。

Git 交付已完成：用户提供首次创建的空仓库 `https://github.com/BCSZSZ/love-story` 并要求推送；本地初始化 `main`、配置 `origin` 后，根提交 `ca3a31a` 已通过普通非强制 push 成功发布到 `origin/main`，本地分支已设置跟踪远端。

生产站点 <https://d2vaw39850chxv.cloudfront.net> 已更新为 v2；管理员回调和登出地址均为该站点根路径。

## 已实现

- 运行时配置升级为 schema v2：初始 62 个动态问题，旧 `residence` 移除并迁移为顶层 `matchCityId`。默认东京，只列东京、上海、北京、大阪等配置中的真实城市，标题动态显示 `{城市}·爱情故事`。
- `RuntimeEngine` 对城市质量只应用一次；每个要求使用 `e = 1 - s × (1 - p)` 的五档强度。`s=1/0.8/0.6/0.4/0` 分别对应必须满足、尽量满足、可以商量、宽松考虑、无要求；`0 < s <= 1` 不改变要求分，`s=0` 才从要求分移除。
- 结果同时返回同城条件池与圈层内可触达人数。默认圈层 2,000/5,000/10,000；朋友、家庭、相亲服务助力按基础圈层 `+50%/+25%/+100%` 加法叠加，并受同城成年人上限约束。
- 普通用户 UI 由运行时目录驱动，支持 v1 草稿迁移、真实城市选择、双结果、圈层/助力预览与应用、逐条件五档、影响前三建议、PNG 和匿名自动保存。
- 管理后台有配置概览、条件管理、城市与圈层、五档、导入/导出与发布五区。可新增/排序/编辑问题和选项、分布、评分、数值桶、预设、城市、圈层、助力及档位；未发布定义可删除，所有历史 published 定义只能 retired。
- `.xlsx` 工作簿使用 12 个固定 sheet，支持规范化 round-trip、差异预览、精确校验和 checksum。会拒绝公式、超链接、富文本/对象、未知或缺失列、宏、外部链接与连接定义，文件和配置 JSON 上限均为 5 MiB。
- 配置服务支持不可变版本正文、draft CAS、发布时 active-pointer 并发条件、激活历史版、公共读取和管理员路由。DynamoDB＋S3 adapter 会校验正文实际 SHA-256；损坏或缺失的 active 配置失败关闭，不偷偷回退。
- 匿名记录绑定配置版本与 checksum 并由服务端精确复算。管理员配置 Lambda 没有匿名 records 表权限；普通用户不进入 Cognito。
- CDK 增加 config DynamoDB 表、私有 versioned 配置桶、公共配置与管理员配置 Lambda、14 条路由、Cognito 邀请制 User Pool、Authorization Code + PKCE、`config-admin` group、`config/write` scope、MFA OFF 和 CloudFront 公共配置缓存。`/api/v2/config/*` 行为先于通用 `/api/*`。
- Cognito 回调支持根路径或 `/index.html` 查询参数并恢复 hash SPA；发布包装器要求真实 HTTPS `ADMIN_CALLBACK_URL`，拒绝 fragment 和占位域名。

深模块边界保持为：`RuntimeConfig` 统一配置与不变量、`RuntimeEngine` 统一估算、`ConfigStore` 隐藏内存/DynamoDB＋S3 差异、`WorkbookCodec` 隐藏 Excel 表结构。前端、记录服务和配置服务只围绕完整配置包协作。

## 本轮真实验证

- `python scripts/validate_design.py`：通过；`legacyFieldCount=63`、`v2QuestionCount=62`、12 个评分字段、10 个历史算例，v2 城市/圈层/助力/五档迁移种子有效。
- 使用 bundled Node `24.19.0` 和 pnpm `11.19.0` 执行 `pnpm doctor:project`：通过；8 个 workspace 项目文件、v1 历史目录和 v2 运行时种子完整。当前系统默认 `node` 仍是 `22.20.0`，不满足项目要求。
- `pnpm verify`：通过；ESLint、7 个 workspace 类型检查、5 个 Vitest 文件共 41 个测试、Web 与 Lambda build 全部完成。Vite 只报告大 chunk 性能警告，不是构建失败。
- `pnpm test:smoke`：4/4 通过，耗时 18.8 秒；桌面 `1280×900` 和移动 `390×844` 各自验证普通用户真实城市/62 问题/双结果/强度/圈层/PNG/恢复，以及管理员新增动态问题、服务端验证、保存草稿和 Excel 导出。
- `pnpm infra:synth`：通过；2 个模板、67 个资源、14 条 API route、3 个 Lambda。断言隔离 IAM、Cognito PKCE、MFA OFF、配置桶 versioning、管理员无法访问匿名记录，以及实际 Lambda bundle 的 Node 语法。
- Git 初始检查确认 workspace 与父目录原本均无 `.git`；`git ls-remote` 确认用户提供的新仓库无 refs 后，才按本次授权初始化 `main`。根提交 `ca3a31a` 已成功推送，没有覆盖任何远端历史。
- `aws sso login --profile personal`：成功；STS 返回账户 `212984411858`、SSO AdministratorAccess 角色。部署前 `pnpm infra:diff` 显示只新增配置/Cognito/管理能力并更新现有应用资源，没有替换或删除 records 表、静态桶或 CloudFront distribution。
- `pnpm release:deploy ...`：重新通过 41 个测试、build、synth 和 diff 后，`Tls-prod-Data` 与 `Tls-prod-App` 均部署成功；静态文件上传完成，CloudFront invalidation `I9MK95ANCXBJF2A1E2OMD1DFI7` 为 Completed。
- 部署资源核验：两个 stack 均 `UPDATE_COMPLETE`；`tls-prod-config` 为 ACTIVE、PAY_PER_REQUEST、删除保护开启；配置桶 versioning Enabled；Cognito MFA OFF、只允许管理员创建、email 登录、authorization code、`openid config/write`、token revocation 与 `config-admin` group 均成立；HTTP API 为 14 条 route；CloudFront 为 Deployed。
- 公网接口核验：health 200、上传开启；active 配置为 `bundle-demo-2.0.0` / checksum `46e5a69d…c2ca` / 62 问题 / 4 城市；管理员认证配置 enabled 且 redirect URI 正确；无 token 管理请求返回 401；active 缓存 60 秒，历史配置一年 immutable 且得到 CloudFront hit。
- `pnpm test:smoke:deployed https://d2vaw39850chxv.cloudfront.net`：桌面 `1280×900` 与移动 `390×844` 全部通过云端保存、双结果、五档、圈层、刷新恢复，桌面 PNG 通过；两条合成记录均 DELETE 204。首次运行暴露公网脚本把完整城市标签误当短标题精确匹配，修正断言后最小复现连续两次及完整 smoke 均通过。
- 部署后 `pnpm infra:diff`：两个 stack 均 `There were no differences`；`tls-prod-api-5xx` 与 `tls-prod-lambda-errors` 均为 OK。Cognito Hosted Login 返回 200 并显示登录表单。

## 未执行或未验证

- 尚未创建应用管理员：Cognito User Pool、Hosted Login 和鉴权边界已部署，但没有用户指定的邀请邮箱，不能代替用户选择收件人。真实管理员登录、配置草稿发布/回滚和 Excel 经生产管理 API 的流程仍待邀请后验证。
- 当前配置表 ItemCount 为 0，公共服务使用打包并校验过的 `bundle-demo-2.0.0` seed；这不是配置发布成功的证据。
- 未在日本网络的真实 PC/手机上验证触摸、系统分享、相册保存或完整 Cognito 跳转；390px Playwright 是浏览器模拟。
- 未配置 `BUDGET_ALERT_EMAIL`，因此没有创建费用邮件通知。大陆网络测试、真实统计参数研究、MFA、实际相亲/聊天和双向接受度仍不在本轮范围。

## 下一步

1. 用户提供应用管理员邀请邮箱后，以 Cognito 受控邀请创建首个管理员并加入 `config-admin`，再验证真实 PKCE 登录、Excel 导入、配置发布与回滚。发送邀请属于新的外部消息动作，不猜测收件人。
2. 用日本真实 PC 与手机完成触摸、系统分享、相册保存和登录跳转验收；不能把 Playwright 模拟描述为实际设备验证。
3. 如需费用告警，另行提供 `BUDGET_ALERT_EMAIL`；未来 AWS 更新仍需逐次授权。
