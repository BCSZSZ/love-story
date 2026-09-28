# 11｜第一轮需求实装计划

状态：`IMPLEMENTED_PUSHED_AND_DEPLOYED / ADMIN_INVITE_PENDING`  
日期：2026-09-28  
范围：落实 `docs/10-first-round-change-spec.md`；本地实现、验证、提交、推送，并在后续取得单次明确授权后部署到 AWS。

## 模块与 seam

- `RuntimeConfig` 模块以一个完整、已校验的配置包作为小接口，隐藏动态问题、城市、圈层、助力、五档和评分配置的解析与不变量。
- `Estimator` 模块只接收规范化输入与 `RuntimeConfig`，一次返回同城条件池、圈层内候选、两侧评分、issues 与可解释 trace。
- `ConfigStore` seam 由内存 adapter（测试/本机）与 DynamoDB＋S3 adapter（生产）实现；配置发布、CAS、历史版本与激活指针留在模块内部。
- `WorkbookCodec` 模块负责 `.xlsx` 与规范化配置包之间的双向转换、定位错误和 checksum；前端后台只调用导入、导出、预检接口。
- Cognito 与 API Gateway JWT authorizer 是管理入口的鉴权 adapter；匿名 Record API 不经过该 seam。

## P0｜规格与版本

- 将确认稿同步到产品、UX、字段、模型、数据/API、AWS、验收和决策文档。
- 创建 schema/catalog/model/config bundle v2；保留 v1 文件和历史读取能力，不原地覆盖。
- 固化城市、圈层、助力和五档默认配置。

完成标准：文档口径一致；配置 v2 能独立通过 schema 校验。

## P1｜动态领域与纯引擎

- 将固定 `FieldId` 改成 catalog 驱动的受校验 ID，同时保留系统保留键。
- 实现动态字段 schema、配置包校验、严格度有效覆盖率、城市基数、圈层/助力与双结果。
- 要求分遵循已确认规则：`0 < s <= 1` 不改分，`s=0` 移除。
- 增加配置新增/retire 问题、单调性、质量守恒和示例算例测试。

完成标准：共享纯 TS 引擎覆盖动态新增问题，无 DOM/AWS 依赖；核心不变量测试通过。

## P2｜普通用户前端

- 动态标题和真实城市单选，移除现居地卡并迁移 v1 草稿。
- 表单由运行时 catalog 渲染，新增问题不需要改前端源码。
- 结果页实现两张结果卡、圈层/助力预览应用、每项五档、影响前三快捷建议和 PNG。
- 快照/autosave 升级 v2，并保持失败状态真实。

完成标准：桌面与 390px 浏览器视口核心流程通过，无横向溢出，预览不污染已保存草稿。

## P3｜管理后台与 Excel

- 实现 `/#/admin` 的配置概览、问题、城市/圈层、五档、导入导出与发布界面。
- 支持新增问题、删除未发布问题、retire 已发布问题，以及选项/比例/评分编辑。
- 实现 `.xlsx` 多 sheet round-trip、客户端安全解析、服务端复验、差异预览和精确单元格错误。
- 本机开发使用显式 dev-admin adapter，不伪装 Cognito 成功。

完成标准：新增问题经配置发布后普通表单可用；有效工作簿 round-trip checksum 一致；错误导入零写入。

## P4｜配置与快照 API

- 增加匿名配置读取和受保护的管理员配置路由；配置草稿、CAS、原子激活、回滚及历史读取。
- 匿名快照按绑定配置包复算；管理员模块无匿名记录表读取权限。
- 分离本机文件/内存 adapter 与生产 DynamoDB＋S3 adapter。

完成标准：API 单元/集成测试覆盖 401/403、冲突、失败不发布、旧版本恢复和匿名边界。

## P5｜IaC、全量验证与推送

- CDK 增加 Cognito（无自助注册、无强制 MFA）、JWT authorizer、配置元数据表和私有版本化配置桶，保持最小 IAM。
- 更新 synth 检查、doctor、smoke 和发布计划；初始实现阶段不执行 deploy，后续获得独立授权后再发布。
- 运行 `pnpm verify`、`pnpm test:smoke`、`pnpm infra:synth` 及可用的只读 diff。
- 更新 `CONTEXT.md`，提交全部本轮改动并推送到既有远端；若仓库/远端仍缺失，只报告精确阻塞，不编造地址。

完成标准：本机验证和离线 synth 通过；推送成功，或唯一阻塞明确为缺失 Git 远端。

## 执行结果（2026-09-28）

- P0～P5 已完成；产品、UX、字段、模型、API、AWS、计划、验收和决策文档已同步为 v2。
- `python scripts/validate_design.py`、Node 24 下的 `pnpm doctor:project`、`pnpm verify`、`pnpm test:smoke` 与 `pnpm infra:synth` 均通过。
- `pnpm verify` 实际结果为 5 个 Vitest 文件、41 个测试；浏览器冒烟为桌面/移动共 4 个流程；synth 为 2 个模板、67 个资源、14 条路由和 3 个 Lambda。
- R6 已完成：用户提供首次创建的空仓库 `https://github.com/BCSZSZ/love-story`；确认远端无 refs 后初始化 `main`，根提交 `ca3a31a` 已通过普通非强制 push 发布到 `origin/main`。
- R7 基础上线已完成：SSO 身份为账户 `212984411858` 的管理员角色；两个 stack 更新成功，前端上传和 invalidation 完成，公网桌面/移动匿名 smoke 通过且合成记录均删除，部署后 diff 为零。Cognito Hosted Login、MFA OFF、受控邀请、回调与无 token 401 已验证；仍缺具体管理员邀请邮箱，因此真实管理员登录、配置发布/回滚和实际手机检查未完成。
