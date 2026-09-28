# 05｜匿名记录、运行时配置与 API

版本：2.0.0 · 日期：2026-09-28。

## 1. 数据域和服务隔离

生产数据分成两个互不共享管理权限的域：

- **匿名记录**：DynamoDB `records` 表保存一次测试的最新完整快照；只有 Record Lambda 可读写。
- **运行时配置**：DynamoDB `config` 表保存版本元数据和激活指针，私有、加密、版本化 S3 桶保存规范化配置正文；Public Config Lambda 只读，Admin Config Lambda 可写。

Admin Config Lambda 不授予匿名记录表权限，后台也没有匿名记录路由。配置 Excel 在管理员浏览器解析，原文件默认不上传、不覆盖。

## 2. 匿名记录语义

一条记录是一次测试，不是一位已验证用户。首次有效编辑创建记录，同一轮只维护最新完整快照；不把每次按键保存为独立事件。`draft` 表示填写中或完成后又修改，`completed` 表示用户点击查看完整结果且输入有效。

浏览器在首次请求前生成 UUID `recordId` 和 32 字节随机管理 token 并写入本机。token 只通过 `Authorization: Bearer` 发送，服务端只存 SHA-256；不能只凭 recordId 修改或删除。没有公开 GET/list/scan，恢复依赖本机草稿。

记录核心形状：

```json
{
  "recordId": "UUID-v4",
  "tokenHash": "SHA-256(random-management-token)",
  "revision": 7,
  "payloadHash": "SHA-256(canonical-payload)",
  "state": "completed",
  "schemaVersion": "2.0.0",
  "configBundleVersion": "config-bundle-demo-2.0.0",
  "configChecksum": "64位小写hex",
  "catalogVersion": "catalog-demo-2.0.0",
  "modelVersion": "model-demo-2.0.0",
  "fxVersion": "fx-demo-1.0.0",
  "createdAt": "服务端时间",
  "updatedAt": "服务端时间",
  "expiresAt": 0,
  "noticeVersion": "privacy-2.0.0",
  "snapshot": {
    "matchCityId": "jp_tokyo",
    "reach": { "tierId": "daily", "boostIds": [] },
    "own": {},
    "requirements": {},
    "currencyInputs": {},
    "result": {},
    "scores": {}
  }
}
```

服务端控制时间、到期、tokenHash、计算结果和 revision，并按指定配置版本/checksum 使用共享引擎重新校验与复算；客户端提交的结果、分数或配置正文不被信任。

## 3. 匿名记录 API

| 方法 / 路径 | 行为 |
|---|---|
| `GET /api/health` | 服务状态，不返回个人数据。 |
| `POST /api/v1/records` | 新建完整快照；revision 必须为 1。 |
| `PUT /api/v1/records/{recordId}` | 用合法管理 token 和下一 revision 替换最新快照；不存在时不 upsert。 |
| `DELETE /api/v1/records/{recordId}` | 验证 token 后清除 snapshot，保留最小墓碑到原到期日。 |

POST 使用 recordId 条件创建；同 ID、同 token、同 payload 的响应丢失重试按幂等成功处理。PUT 使用 CAS；同 revision 同 payload 为幂等，不同 payload 或落后 revision 返回 409。删除、过期记录不能被迟到请求复活。

请求体最大 64 KiB。主要错误码：`INVALID_INPUT`、`UNAUTHORIZED_RECORD`、`NOT_FOUND`、`REVISION_CONFLICT`、`MODEL_VERSION_UNSUPPORTED`、`RECORD_EXPIRED_OR_DELETED`、`PAYLOAD_TOO_LARGE`、`RATE_LIMITED`、`TEMPORARY_UNAVAILABLE`。

## 4. 公共配置 API

| 方法 / 路径 | 缓存 | 行为 |
|---|---|---|
| `GET /api/v2/config/active` | `max-age=60, stale-if-error=86400` | 返回当前激活完整配置和 checksum。 |
| `GET /api/v2/config/{bundleVersion}` | 一年、immutable | 返回指定不可变历史配置和 checksum。 |
| `GET /api/v2/config/admin-auth` | 5 分钟 | 返回公开的 Cognito issuer/client/PKCE 端点；本机模式返回 `enabled:false`。 |

浏览器校验规范化 checksum 后才采用配置。新草稿使用 active 版本；已有草稿继续加载其固定历史版本。网络失败时可使用已验证缓存或内置 seed，并明确显示状态。

## 5. 管理配置 API

以下路由由 API Gateway JWT authorizer 要求 `config/write` scope；Lambda 再检查 `sub`、scope 及 `cognito:groups` 中的 `config-admin`。只有本机开发模式跳过外部登录。

| 方法 / 路径 | 行为 |
|---|---|
| `GET /api/admin/v1/configs` | 当前激活版本、版本元数据列表，以及跨全部 published 版本汇总的受保护问题/选项/城市/圈层/助力 ID；后台据此只允许未发布定义物理删除。 |
| `POST /api/admin/v1/configs/validate` | 共享 schema、交叉引用、质量、单调性和 checksum 校验；无写入。 |
| `POST /api/admin/v1/configs` | 创建新的配置草稿，成功返回 201。 |
| `PUT /api/admin/v1/configs/{version}` | 以 revision CAS 替换尚未发布草稿。 |
| `POST /api/admin/v1/configs/{version}/publish` | 将通过校验的草稿变成不可变 published 版本。 |
| `POST /api/admin/v1/configs/{version}/activate` | 原子切换 active 指针；用于发布后启用或回滚。 |
| `GET /api/admin/v1/configs/{version}/export` | 返回指定版本配置及元数据；浏览器据此生成 `.xlsx`。 |

配置 JSON 请求上限 5 MiB，与工作簿文件上限一致。所有写入都在服务端再次规范化并计算 checksum。审计元数据只包含版本、revision、状态、时间、Cognito `sub` 和 checksum，不包含匿名答卷。

## 6. 配置版本约束

一次发布绑定 `configBundleVersion`、`catalogVersion`、`modelVersion`、`fxVersion` 和 checksum。published 内容不可修改；回滚只切换指针。尚未发布的新问题可以删除；发布过的问题只能 `retired`，不得复用 ID 或改变类型。至少保留仍被未过期记录或本机草稿引用的版本。

运行时配置校验包括：恰好一个默认 active 城市和圈层、城市质量加 residual 为 1、各问题分布完整、枚举/数值质量为 1、评分定义完整、五档严格递减且端点为 1/0、所有引用存在，以及新增问题使用支持的模板和运算符。

## 7. Excel 导入导出

只接受 `.xlsx`，上限 5 MiB 和 10,000 数据行；拒绝 `.xls`、`.xlsm`、多余/缺失 sheet、公式、超链接和对象单元格。固定 sheet 为 `README`、`Manifest`、`Cities`、`Fields`、`Options`、`NumericBuckets`、`Presets`、`RelativePresets`、`ScoreKnots`、`ReachTiers`、`ReachBoosts`、`StrictnessLevels`。

导入只生成本地编辑副本，通过浏览器和服务端两轮校验后才能保存草稿；不会自动发布。导出生成新文件。“导出 → 不修改 → 导入”的规范化配置 checksum 必须一致。

## 8. 自动保存、到期和隐私

每次有效编辑先保存本机，再以防抖队列写云端；只有收到服务端确认才显示“云端已保存”。断网、429 或 503 保留待发 revision 并退避重试，不依赖页面关闭时的 beacon。

到期为服务端 UTC 创建时间加一个公历年；2 月 29 日到次年 2 月 28 日同一 UTC 时刻。编辑不续期。DynamoDB TTL 的物理删除可能滞后，因此一年到期后立即业务失效，后台清理时间不作到秒承诺。

日志只保留 requestId、归一化 routeKey、状态、耗时和固定错误类型；不得记录 Authorization、body、recordId、答案、密码、授权码或完整 claims。配置后台身份与匿名答卷不建立关联。
