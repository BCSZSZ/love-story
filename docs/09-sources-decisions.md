# 09｜来源、设计决策与变更规则

核对日期：2026-09-28。官方资料会更新，部署日再次核对运行时、价格和服务支持。以下资料用于技术设计；没有任何网页来源用于背书本包演示人口、评分或圈层系数。

## 1. 需求来源

用户提供《东京·爱情故事.xlsx》Sheet1，以及本对话逐轮确认。后确认的同一评分模型、默认上传一年、日本首发、真实匹配城市、五档排除强度、圈层助力和管理员配置后台等规则高于 Excel 早期草稿；不再恢复被删除的 AI 颜值。v1 的 63 个普通字段在 v2 移除 `residence` 后变为 62 个问卷问题，另有一个顶层 `matchCityId`；管理员以后可新增问题。字段拆分见 03，第一轮确认版见 10。

## 2. 官方技术参考

**[S1] DynamoDB TTL：到期自动清理及延迟**  
`https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html`

**[S2] DynamoDB：按需计费、WRU粒度、PITR与S3导出格式**  
`https://aws.amazon.com/dynamodb/pricing/`

**[S3] Lambda临时存储：/tmp与执行环境**  
`https://docs.aws.amazon.com/lambda/latest/dg/configuration-ephemeral-storage.html`

**[S4] CloudFront OAC与私有S3源**  
`https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html`

**[S5] CloudFront管理的源请求策略与Host**  
`https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html`

**[S6] HTTP API节流机制**  
`https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html`

**[S7] API Gateway计价**  
`https://aws.amazon.com/api-gateway/pricing/`

**[S8] Lambda计价**  
`https://aws.amazon.com/lambda/pricing/`

**[S9] Lambda支持的运行时与SDK打包建议**  
`https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html`

**[S10] Vite官方入门与静态构建**  
`https://vite.dev/guide/`

**[S11] React官方客户端应用搭建说明**  
`https://react.dev/learn/build-a-react-app-from-scratch`

**[S12] html-to-image作者项目与导出限制**  
`https://github.com/bubkoo/html-to-image`

**[S13] CDK bootstrap会准备云资源**  
`https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html`

**[S14] CloudFront当前按量/flat-rate方案**  
`https://aws.amazon.com/cloudfront/pricing/`

**[S15] AWS Budgets及告警延迟**  
`https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html`

**[S16] CDK diff命令与change-set选项**  
`https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-diff.html`

**[S17] CloudFront自定义域名ACM证书区域**  
`https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html`

**[S18] Cognito Authorization Code + PKCE**  
`https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html`

**[S19] API Gateway HTTP API JWT authorizer**  
`https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html`

**[S20] S3 Versioning**  
`https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html`

## 3. 本次设计决策

| ADR | 决策 | 取舍 |
|---|---|---|
| 001 | 浏览器计算、服务端同引擎复算保存 | 少网络依赖；客户端参数公开，不能当反作弊秘密。 |
| 002 | 先用独立系数且明确演示 | 快速实现；不提供统计准确性或相关性保证。 |
| 003 | 同一g函数为两侧评分，要求取允许集合最低分 | 有清晰可实现语义；不是偏好概率，也不要求对分差做评价。 |
| 004 | DynamoDB保存最新快照，不用在线Parquet | 适合反复更新、条件写、到期；未来分析需另行转换。 |
| 005 | 普通用户记录持有者使用随机 token，无账号与公开读取 | 保护修改权；失去本机凭据无法找回。管理员 Cognito 身份不与匿名记录关联。 |
| 006 | 公历一年失效＋TTL后台清理，无PITR | 简单且减少副本；非精确物理删除SLA，无误删恢复。 |
| 007 | S3/CloudFront＋HTTP API/Lambda，东京单区域 | 不运维常驻主机；不保证大陆访问效果。 |
| 008 | hash路由、无SSR、无照片、无远程字体 | 降低部署与导图复杂度；首版不追求公开结果SEO。 |
| 009 | 短bootstrap＋按需文档；无默认push/deploy | Agent可自主完成本地工作，不自动消耗云费用或改远端。 |
| 010 | `residence` 升级为顶层单选真实匹配城市 | 避免双方现居地冲突和重复扣减；城市不能设为无要求。 |
| 011 | 五档只改变排除强度，使用 `e=1-s(1-p)` | 与具体年龄/金额档位分离；0.4～1 保持原要求分，0 才移除评分项。 |
| 012 | 同城条件池和圈层内可达共享同一条件覆盖率 | 同时表达城市规模与现实触达规模；不声称是真实社交图谱。 |
| 013 | 圈层助力按基础值加法叠加并以同城成年人封顶 | 易解释且符合确认口径；不处理助力重叠的真实相关性。 |
| 014 | RuntimeEngine 接收完整配置包，字段 ID 改为运行时字符串 | 管理员可新增问题；发布校验承担原编译期 union 的一致性责任。 |
| 015 | 配置正文 S3、元数据/指针 DynamoDB，版本不可变 | 支持原子激活和回滚；需要长期保留被匿名草稿引用的版本。 |
| 016 | 管理员 Cognito PKCE、单一 `config-admin` 角色、MFA OFF | 普通用户仍匿名，首轮权限简单；以后启用 MFA 需另行决策。 |
| 017 | Excel 是严格交换格式而非运行时数据库 | 便于批量编辑；拒绝公式、宏、外链并要求 round-trip checksum。 |

## 4. 修改协议

业务需求改变先更新01；字段ID/语义改变更新catalogVersion；系数/分值改变创建新modelVersion；数据schema改变说明迁移；云资源改变附diff与费用影响。为修小bug不重复询问已确认需求，但不得用“合理优化”恢复排除项。

AGENTS、harness、权限策略的改变必须单独说明，不能与业务功能混合偷偷放宽。任何所谓guard配置都是软件约束，只有被实际工具/权限机制执行才算强制；一个JSON文件本身不是安全沙箱。
