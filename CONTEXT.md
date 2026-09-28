# 当前项目状态

更新时间：2026-09-28。

## 结论

第一轮确认规格 `docs/10-first-round-change-spec.md` 已完成本地实装并通过静态、单元/集成、浏览器和离线 IaC 验证。用户已明确授权本轮实现与 Git 推送，但没有授权 AWS 部署。

Git 交付已完成：用户提供首次创建的空仓库 `https://github.com/BCSZSZ/love-story` 并要求推送；本地初始化 `main`、配置 `origin` 后，根提交 `ca3a31a` 已通过普通非强制 push 成功发布到 `origin/main`，本地分支已设置跟踪远端。

历史站点 <https://d2vaw39850chxv.cloudfront.net> 是先前部署的 v1；本轮 v2 未部署，也未针对该历史地址运行新的 v2 线上冒烟。

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

## 未执行或未验证

- 未运行 `pnpm infra:diff`：没有显式 AWS profile/账户，本轮也没有 AWS 操作需要。
- 未执行 AWS bootstrap/deploy、静态上传、CloudFront invalidation、Cognito 管理员创建或真实 DynamoDB/S3 配置发布。
- 未运行新版 `test:smoke:deployed`，因为没有已部署 v2 地址；历史 v1 地址不符合该脚本前提。
- 未在日本网络的真实 PC/手机上验证触摸、系统分享、相册保存或 Cognito 跳转；390px Playwright 是浏览器模拟。
- 大陆网络测试、真实统计参数研究、MFA、实际相亲/登录/聊天、双向接受度仍不在本轮范围。

## 下一步

1. 如需上线 v2，另行取得针对 AWS 账户、区域、回调地址和本次写操作的明确授权，再依次执行只读 diff、deploy 和真实 Cognito/配置/匿名流程验证。
2. 上线后补做日本真实 PC 与手机验收；不能把 Playwright 模拟描述为实际设备验证。
