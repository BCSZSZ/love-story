# 06｜技术架构、AWS 部署与费用控制

核对日期：2026-09-28。以下描述是当前 IaC 设计与本地 synth 状态，不代表资源已经部署。官方资料索引见 09。

## 1. 技术栈

| 层 | 当前选择 |
|---|---|
| 前端 | React + TypeScript + Vite 客户端 SPA；CSS/Grid/Flex；`html-to-image` 导出 PNG |
| 共享逻辑 | 纯 TypeScript domain、运行时配置、估算/评分引擎、Excel 工作簿模块 |
| API | API Gateway HTTP API + 三个隔离 Lambda，Node.js 24 / ARM64 |
| 匿名记录 | DynamoDB Standard on-demand，TTL，一条记录保存最新快照 |
| 配置 | DynamoDB 元数据/激活指针 + 私有、加密、版本化 S3 配置正文桶 |
| 管理员身份 | Cognito User Pool，Authorization Code + PKCE，自助注册关闭，MFA OFF |
| 静态发布 | 私有 S3 + CloudFront OAC |
| IaC | AWS CDK v2 + TypeScript |
| 验证 | Vitest、Playwright PC/手机核心流程、离线 CDK synth |

不创建 EC2、VPC、NAT Gateway、ALB、RDS、Neptune、OpenSearch、ECS、Bedrock 或跨区数据库。普通用户不进入 Cognito。

## 2. 拓扑和信任边界

```text
浏览器
  ├─ 本机：运行时表单、人数/评分、五档预览、Excel解析、PNG、草稿
  └─ CloudFront
       ├─ /*                     → 私有静态 S3（OAC）
       ├─ /api/v1/records*      → Record Lambda
       │                            ├─ records DynamoDB：读写
       │                            └─ config DynamoDB/S3：只读指定版本
       ├─ /api/v2/config/*      → Public Config Lambda
       │                            └─ config DynamoDB/S3：只读
       └─ /api/admin/v1/*       → HTTP API JWT authorizer
                                    → Admin Config Lambda
                                       └─ config DynamoDB/S3：读写

Cognito Hosted Login ── PKCE ──> 管理后台
```

Admin Config Lambda 和 Public Config Lambda 都没有匿名 records 表权限。Record Lambda 没有配置写权限。API Gateway 校验 issuer、audience 和 `config/write` scope；Admin Lambda 再校验 `sub`、scope、`config-admin` group。任何一个检查失败都拒绝。

## 3. Cognito 设置

- `selfSignUpEnabled=false`，只允许管理员邀请/创建用户。
- 邮箱登录、大小写不敏感；密码至少 14 位并要求大小写、数字、符号；临时密码 7 天。
- MFA 明确为 OFF；首轮不要求 MFA。
- Web client 无 secret，只允许 authorization code grant；启用 token revocation。
- access/id token 1 小时，refresh token 1 天。
- 回调和登出 URL 必须通过部署参数 `ADMIN_CALLBACK_URL` 提供；`https://localhost.invalid/` 只允许离线 synth 占位，不能用于真实部署。
- 本机开发额外允许 `http://127.0.0.1:5173/`。

## 4. 数据资源

`DataStack` 创建：

- `tls-{stage}-records`：分区键 `recordId`、on-demand、TTL `expiresAt`、prod 删除保护、RETAIN。
- `tls-{stage}-config`：分区键 `configKey`、on-demand、prod 删除保护、RETAIN。
- `tls-{stage}-{account}-{region}-config`：block public access、S3 managed encryption、SSL、versioning、RETAIN。

`AppStack` 创建静态桶、CloudFront、HTTP API、三个 Lambda/独立 IAM role、Cognito、14 天日志、基本 Lambda/API 5xx 告警，以及提供邮箱时的预算提醒。

## 5. 路由、缓存与安全头

| Behavior | 缓存策略 |
|---|---|
| `/assets/*` | 内容哈希静态资源长缓存 |
| `/api/v2/config/*` | active 60 秒，历史版本一年 immutable；响应头仍由接口细分 |
| 其他 `/api/*` | 缓存关闭，转发 Authorization，`no-store` |
| 默认 HTML | TTL 0/短重验证 |

CloudFront 使用 `AllViewerExceptHostHeader` 等价源请求策略，不把浏览器 Host 原样传给 API Gateway。hash 路由不需要把 API 或缺失资源的 404 改写成 200 HTML。

安全响应头包括 CSP、nosniff、no-referrer、DENY frame 和一年 HSTS。CSP 只额外放行 Cognito 登录连接以及导图所需 data/blob 图片。CloudFront 标准日志关闭；API/Lambda 日志不记录 body、token、答案或完整 claims。

HTTP API stage 默认 10 req/s、burst 20；创建记录路由 2 req/s、burst 5。Record/Public Config Lambda reserved concurrency 5，Admin Config 为 2。节流不是身份鉴别或硬费用上限。

## 6. 本地与部署参数

本机 API 只监听 127.0.0.1，使用文件记录 adapter 和内存配置 store；这两者不能部署为生产持久层。

主要部署输入：`AWS_ACCOUNT_ID`、`AWS_PROFILE`、`AWS_REGION=ap-northeast-1`、`APP_STAGE`、`ADMIN_CALLBACK_URL`，以及可选 `BUDGET_ALERT_EMAIL`。部署包装器强制要求显式的真实 HTTPS 站点根地址（或 `/index.html`）作为管理员回调，且该地址不能含 `#` fragment；回调返回的 query 会由 SPA 引导到 `/#/admin` 完成 PKCE 交换。真实账户、域名、邮箱和回调 URL 不写入 Git、不猜测。`VITE_*` 只能放公开配置。

没有账户时仍可 build 和离线 synth。占位账户与 `localhost.invalid` 只用于模板验证，不能解释为部署授权。

## 7. 验证、diff 与部署权限

本地关卡：`pnpm verify`、`pnpm test:smoke`、`pnpm infra:synth`。`infra:synth` 只生成模板，不调用远端。`pnpm infra:diff` 在有有效 AWS 只读身份时运行 `cdk diff --no-change-set`；缺少身份时必须明确报告，不能伪造 diff。

创建 Cognito、DynamoDB、S3、CloudFront、API、Lambda、IAM、日志、告警或 Budget 都属于 AWS 写操作，需要针对该次部署的明确授权和正确账户/区域。当前第一轮授权只包含实现和 Git 推送，不包含 bootstrap/deploy。

实际部署前必须：

1. 通过本地关卡并记录真实输出。
2. 校验 AWS 身份、东京区域、stage 和真实 `ADMIN_CALLBACK_URL`。
3. 展示 diff、资源和费用影响。
4. 获得部署授权后才 bootstrap/deploy。
5. 部署后再验证 Cognito 登录、配置发布/回滚、匿名保存、CloudFront 缓存及日本 PC/手机流程。

## 8. 费用与回滚

主要费用变量为 CloudFront 流量、HTTP API 请求、三个 Lambda、两个 DynamoDB 表、两个 S3 桶、Cognito 活跃管理员及日志。配置读通常可缓存，但后台发布和版本正文增加少量 S3/DynamoDB 用量。预算告警是延迟通知，不是消费硬上限；不得承诺免费。

回滚配置只切换 active 指针，历史版本保持不可变；前端和 Lambda 恢复上一个已验证构建。匿名记录表和配置存储不通过删库重建回滚。异常时可关闭匿名上传或限制 API，但任何远程删除、扫描或资源销毁仍需单独授权。
