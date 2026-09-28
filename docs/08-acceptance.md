# 08｜第一轮轻量验收清单

版本：2.0.0。目标是覆盖高风险行为，不扩展为大规模设备矩阵、压力平台或多地区 CI。

## 1. 城市、字段和迁移

1. 初始只显示东京、上海、北京、大阪等 active 真实城市，默认东京；没有省、大区或“其他地区”。
2. 标题随城市变为 `{城市}·爱情故事`；同一个 `matchCityId` 同时代表双方现居城市，城市质量只应用一次。
3. v2 普通问卷为 62 个 active 问题且没有 `residence`；每个问题都有有效控件、分布和选择效果。
4. 管理员新增一个支持模板的问题后，前端表单、引擎、API 和工作簿都能处理，不要求修改 `FieldId` union。
5. 未发布新问题可删除；发布过的问题只能 retired，不能复用 ID、改变 kind 或从历史版消失。
6. v1 草稿保留非地域答案；城市必须按迁移规则确认，未确认不能完成或上传为 v2。

## 2. 人数、圈层和评分

7. 开场为 80 亿；开始后成年人系数只应用一次。全无普通条件时，同城池为 `B×a×cityMass`。
8. 对每个条件验证 `e=1-s(1-p)`；`s` 从 1 降到 0 时结果单调不减，0 档有效系数为 1。
9. 城市结果为 `cityAdultBase×conditionCoverage`；圈层结果为 `effectiveReach×conditionCoverage`，不是两个规模相乘。
10. 助力按基础圈层加法叠加：朋友 +50%、家庭 +25%、相亲服务 +100%，并以同城成年人规模封顶；重复 boost ID 不重复计入。
11. 数值范围双端包含；枚举预设展开去重；标签使用 any-of；相对要求缺少自身值时 pending 且阻止 completed。
12. 自身和对象同一答案使用同一评分函数；强度 0.4～1 不改变要求分，0 才移除评分项；评分不乘入人数。
13. 小正数显示不足 1 人，数学零单独标记；结果 JSON 无 `NaN`/`Infinity`。
14. 行内五档预览只改变该行；合并预览显示所有未应用调整；应用前不保存。
15. 高影响建议最多三项，每条只放松相邻一档，不把多条增量相加。

## 3. 配置与 Excel

16. 完整运行时配置规范化后 checksum 稳定；浏览器、API 和工作簿对同一配置一致。
17. 城市质量加 residual、互斥枚举质量、数值桶质量都在容差内合计 1；标签 prevalence 在 `[0,1]`。
18. 恰好一个默认 active 城市和圈层；五档恰好为严格递减的 1、0.8、0.6、0.4、0。
19. active 问题不能缺控件、选项/桶、人口分布或启用评分时的评分值，不能固定 `p=1` 冒充。
20. `.xlsx` 导出再原样导入得到相同规范化 checksum。
21. `.xls`、`.xlsm`、超过 5 MiB/10,000 行、sheet 缺失或多余、公式、超链接、对象值、坏引用和坏 mass 被整份拒绝，并给出定位 issue。
22. 导入只更新后台本地编辑副本，不自动保存或发布；published 版本不可覆盖，激活旧 published 版本可回滚。

## 4. 认证、权限和 API

23. 普通用户流程不要求 Cognito；管理员生产登录使用无 client secret 的 Authorization Code + PKCE。
24. Cognito 自助注册关闭、MFA OFF、存在 `config-admin` group 和 `config/write` scope；JWT authorizer 与 Lambda 二次校验同时存在。
25. Admin Config IAM 没有 records 表权限；Public Config 只读；Record 服务只读指定配置版本且不能写配置。
26. active 配置短缓存，历史版本 immutable 长缓存；管理 API 和匿名记录 API `no-store`。
27. 匿名保存必须匹配 schema、bundle version 和 checksum，服务端用准确历史配置复算双结果和分数。
28. POST/PUT 幂等与 CAS、错误 token 拒绝、一年不续期、删除墓碑和无公开记录 GET/list 行为保持通过。
29. 日志、URL、分享图和构建产物不泄漏管理 token、Cognito token/授权码、完整 claims 或未选择导出的自身答案。

## 5. 浏览器流程

在桌面和约 390px 手机视口分别运行：

1. 首页确认东京并看到动态标题。
2. 开始后跳过部分自身答案，设置年龄、国籍、院校和收入要求。
3. 切换城市并确认其余答案保持。
4. 查看同城条件池、圈层内可达和两侧评分。
5. 切换圈层和多个助力，确认只预览；应用后结果及草稿更新。
6. 调整单项五档，检查行内与合并预览；应用后刷新恢复。
7. 导出同时含两个结果的 PNG；页面无横向溢出。
8. 进入本机后台，新增问题、验证、保存草稿并导出 `.xlsx`。

Playwright 模拟不能替代真实手机。上线后仍需日本网络的一台真实 PC 和一部实际手机检查触摸、下载/系统分享、Cognito 跳转及真实服务状态。

## 6. 基础设施和完成定义

离线 synth 至少断言：2 个 stack、records/config 两表、私有 versioned config bucket、3 个 Lambda、14 条 API route、Cognito PKCE、MFA OFF、隔离 IAM、CloudFront public-config 缓存、无 VPC/NAT/EC2/RDS/Bedrock。

R0～R5 完成表示代码、本机 mock、构建、smoke 和 synth 已验证；不表示 Git 已推送、AWS 已更新、真实 Cognito 已登录或线上已验收。Git 交付要求合法 repository/remote 和成功 push 输出；R7 线上完成另需 diff、部署授权、实际部署和线上验证证据。
