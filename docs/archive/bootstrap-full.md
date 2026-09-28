# 东京·爱情故事｜完整自包含 Agent Bootstrap

版本1.0.0｜2026-09-26。本文件包含完整需求、设计、部署开发计划、63字段配置、演示模型、参考类型、10组算例与校验脚本。无需再索取原始聊天记录或其他附件。它不是已经实现的网页应用。

## 给Agent的执行指令

先读取当前工作区已有规则与文件，保护用户修改。首次初始化，将本文件保留为归档（例如`docs/archive/bootstrap-full.md`），再按下方BEGIN FILE / END FILE区块写入对应文件路径；区块内的外层八反引号只是容器，不属于文件内容。已经存在的文件先读取比较合并，不盲目覆盖；特别注意完整文件与展开后的短入口都叫bootstrap.md时先备份完整输入。

展开后从短入口`bootstrap.md`开始，再读AGENTS.md、CONTEXT.md、docs/01-product.md和docs/07-plan.md。其余文档按任务读取，不每轮加载全部配置。先实现P0～P5可离线完成的部分；不为粗略系数停工，不自行扩大范围。默认不commit、不push、不运行AWS bootstrap/deploy或创建付费资源。实际部署需要用户另行明确授权。

字段定义和演示模型已有完整默认值；不需要再次问用户是否使用优先偏好、是否登录、是否默认上传等已确定事项。只给出骨架、TODO或几个示例字段不算完成。所有63字段必须可用，未来双向接受度当前只留接口。

## 包内文件

- `bootstrap.md`
- `AGENTS.md`
- `CONTEXT.md`
- `CLAUDE.md`
- `README.md`
- `harness.json`
- `MANIFEST.sha256`
- `config/catalog.demo.v1.json`
- `config/deploy.example.json`
- `config/gitignore.example`
- `config/model.demo.v1.json`
- `contracts/domain.ts`
- `docs/01-product.md`
- `docs/02-ux.md`
- `docs/03-fields.md`
- `docs/04-model.md`
- `docs/05-data-api.md`
- `docs/06-aws.md`
- `docs/07-plan.md`
- `docs/08-acceptance.md`
- `docs/09-sources-decisions.md`
- `examples/fixtures.demo.v1.json`
- `reference/excel-fields.md`
- `scripts/validate_design.py`
- `validation-report.json`

---

<!-- BEGIN FILE: bootstrap.md -->
````````markdown
# 东京·爱情故事｜Agent项目启动入口

版本1.0.0｜2026-09-26。先完成可运行首版，再调整系数。此包是已定稿设计，不是现成应用；不要把配置校验通过当作应用实现或上线。

## 第一次执行

先读工作区已有AGENTS/代码/Git状态，保护现有文件。然后读本包AGENTS.md、CONTEXT.md、docs/01-product.md、docs/07-plan.md。业务不再重新调研确认；依当前阶段按需读取其他规格，连续推进可以完成的本地开发。

目标：做一个面向中文用户、PC/手机适配的择偶人数估算网页。工作名东京·爱情故事。开场80亿演示基数，开始后明确筛成年人；每项先自己的情况，再选对方要求。仅“有要求／无要求”，没有优先偏好。候选人数常驻、稀缺提示、同一模型两侧评分、单项放宽、完整PNG导出。

全部63个字段已有config定义及演示分布。先支持粗略模型，不等研究真实系数。相同评分函数为两侧评分；评分不得影响人数。未来双向接受度留接口，首版不伪造该功能。

默认匿名自动上传完整快照，草稿/完成，同一测试更新同一记录；一年到期失效，TTL后台清理可能滞后。无身份、登录、聊天、管理后台。自身详情默认不导图。日本能用即可，大陆另行测试。

## 技术方案

React + TypeScript + Vite；原生响应式CSS；共享纯TS引擎；html-to-image；HTTP API + Node24 Lambda + DynamoDB；私有S3 + CloudFront OAC；CDK TypeScript；主区域ap-northeast-1。无VPC/NAT/EC2/RDS/Bedrock/Cognito。先本地实现；线上资源另行授权。

## 按需导航

| 做什么 | 读什么 |
|---|---|
| 范围、默认行为 | docs/01-product.md |
| 布局、交互、导图 | docs/02-ux.md |
| 字段与选项 | docs/03-fields.md + config/catalog.demo.v1.json |
| 人数/分数/放宽 | docs/04-model.md + config/model.demo.v1.json + examples/fixtures.demo.v1.json |
| 保存/接口/隐私 | docs/05-data-api.md + contracts/domain.ts |
| 云架构、费用、部署 | docs/06-aws.md |
| 分阶段执行 | docs/07-plan.md |
| 少量验收 | docs/08-acceptance.md |
| 来源/技术决定 | docs/09-sources-decisions.md |

## 本次默认允许与禁止

允许本地新增/修改项目代码、安装锁定依赖、运行本地验证和无远端lookup的CDK synth。遵守已有更严格的工作区规则。不擅自切分支、丢弃用户修改或改写Git历史。默认不commit、不push；用户可另行授权本地commit。

禁止未经明确授权的git push、远端PR/merge、CDK bootstrap/deploy、创建付费资源、发布公网服务、删除云数据、读取/扫描真实业务记录、修改既有DNS。AWS凭据缺失不阻塞P0～P5。JSON权限标记不是强制沙箱；应使用实际受限凭据/工具权限和发布包装器执行边界。

## 首轮具体行动

P0建立workspace与命令；P1接入全部字段、模型和纯引擎；P2先打通年龄/国籍/地区/学历/收入等纵向流程，然后在同阶段补齐63字段；P3结果/放宽/导图；P4保存与生产adapter；P5CDK与发布准备。不要只搭骨架、只写TODO或只实现6个示例字段就宣称完成。P6等待部署授权。

本地必须可执行doctor、dev、verify、build、infra:synth；命令含义在07。轻量测试聚焦算术、保存权限和一条核心浏览器流程，不引入重型测试平台。

每阶段更新CONTEXT：真正完成了什么、实际执行的验证和结果、剩余阻塞、下一步。初始化完成后本入口只作索引；后续先读AGENTS+CONTEXT和相关规格，不每次全量加载全部文档或整个JSON。
````````
<!-- END FILE: bootstrap.md -->

<!-- BEGIN FILE: AGENTS.md -->
````````markdown
# Agent工作协议

## 常驻规则

本项目是匿名择偶条件估算器，不是实际相亲服务。对话已确认范围见docs/01-product.md。最新明确用户指令优先，其次本文件与规格；遇到当前工作区已有更严格安全/Git规则继续遵守，不覆盖。

每次先读CONTEXT.md，再按任务读一至三个相关规格。不要每次吞入全部bootstrap、字段JSON和来源全文；查某字段时按ID定位。初始化从bootstrap.md进入，后续无需反复执行初始化。

## 不得改变的边界

- 有要求/无要求，没有优先偏好。成年人限制明确展示，不能偷偷多乘系数。
- 自身和对方同一个评分函数；分数与人数独立；未来双向功能当前not_implemented。
- 系数可粗糙但功能必须完整；63字段不能留下无效控件或固定p=1的偷懒实现。
- 数字中性，演示数据明确标识；不声称真实统计，不羞辱用户，不人为调到零。
- 默认匿名上传一年，禁止记录身份、token日志和公开读取。保存失败不能伪称成功。
- 无AI照片/登录/聊天/后台/LLM/NAT/EC2；大陆专项测试非首发要求。

## 权限

默认只允许本地开发和验证。禁止自动git push、commit、切分支、force/reset用户工作、发布公网、AWS bootstrap/deploy、付费资源创建、数据扫描/删除、DNS变更。当前明确授权可覆盖对应单次动作，但不能解释成永久授权。Git远端、AWS账户、邮箱、域名缺失时不编造。

harness.json为项目协议，不是安全产品。使用实际工具权限与最小IAM角色落实；发布脚本要求显式账户/区域/授权参数，且不能仅凭模型自行设置一个环境变量就认定获得用户授权。

## 实施与验证

按docs/07-plan.md P0～P5连续推进，不因未定统计参数或未提供AWS账号停止本地工作。代码使用TS，共享引擎不得混入DOM/AWS依赖。配置改变创建新版本。修改业务规则同步文档；不得为了通过测试改期望值来掩盖算法错误。

报告区分：设计完成、实现完成、mock通过、真实服务验证、线上验证。不存在的命令、未运行的测试、未部署的URL不能报告为完成。测试范围见08，不自行扩展为复杂多地区体系。

复杂变更先记录简短执行计划；权限/harness/评分口径修改独立说明影响。不要修改用户上传原Excel。本包contracts为参考契约，落实到domain包并维护一致。

## 收尾

更新CONTEXT并列真实验证命令、结果、未做事项。代码未提交不擅自提交；提交过也不意味着允许push。下一次会话从CONTEXT继续，不重新问已经确认的问题。
````````
<!-- END FILE: AGENTS.md -->

<!-- BEGIN FILE: CONTEXT.md -->
````````markdown
# 当前项目状态

更新时间：2026-09-26。

## 已完成

需求基线、页面设计、63字段初版选项、63字段演示分布、12项统一评分、API/记录/一年到期方案、AWS部署设计、阶段计划、验收清单、Agent协议与参考契约已形成。

本包附带设计校验脚本与演示算例。设计包校验结果应以validation-report.json为准。

## 尚未完成

尚无React应用、Lambda实现、CDK资源代码或项目package.json。尚未运行pnpm应用测试、真实DynamoDB验证或日本设备冒烟；没有部署，没有公网应用URL，没有创建任何AWS资源。

## 下一步

Agent从P0开始，优先读取01与07；然后实现P1纯引擎、P2全部字段界面。无需再次确认优先偏好/评分/默认上传等已决定问题。

## 待部署时提供

AWS目标账号/profile、明确部署授权；自定义域名可选、告警邮箱待提供。不把这些列为本地开发阻塞。当前允许本地开发，不允许push或云资源写入。
````````
<!-- END FILE: CONTEXT.md -->

<!-- BEGIN FILE: CLAUDE.md -->
````````markdown
@AGENTS.md

先读取CONTEXT.md；详细规格按AGENTS.md导航读取。
````````
<!-- END FILE: CLAUDE.md -->

<!-- BEGIN FILE: README.md -->
````````markdown
# 东京·爱情故事｜设计与Agent启动包

这是可直接交给编码Agent的需求/设计材料，不是已实现或部署的应用。

## 使用

把整个目录放入项目工作区，交给Agent：

> 先读取bootstrap.md，遵守AGENTS.md。以本包为已确认需求，不再重新讨论产品范围。从P0开始连续推进本地开发，先实现共享引擎与完整响应式表单，再完成结果导图、匿名保存和CDK部署准备。不要只写骨架；所有63字段必须可用。默认不commit、不push、不bootstrap/deploy AWS。需要云账号时先继续可离线完成部分，并在CONTEXT记录真实进度。

bootstrap.md是短入口；AGENTS/CONTEXT常驻；docs按任务展开。config包含完整演示参数，contracts是参考类型，examples包含算例，scripts/validate_design.py用于检查本设计包结构及算术。

校验命令：`python scripts/validate_design.py`。它不测试尚未存在的应用，不调用AWS。应用落地后的pnpm命令由Agent按07创建。

## 主要决定

React/TS/Vite＋客户端计算；私有S3/CloudFront发布；HTTP API/Lambda/DynamoDB保存；东京单区域。无登录、聊天、AI颜值、后台或优先偏好。自身和对方同模型评分。演示参数不是真实人口数据。

记录一年到期业务失效，TTL物理清理可能滞后。匿名token保护修改，不收身份信息。结果PNG在本机生成，不上传。

## 文件导航

产品见docs/01-product.md；UI见02；字段见03；计算见04；存储API见05；AWS与费用见06；实施计划见07；轻量验收见08；官方技术来源与决策见09。

P0～P5可由Agent在本机完成；P6实际部署需另外明确授权。本包没有配置AWS密钥、没有创建资源、没有真实用户数据。
````````
<!-- END FILE: README.md -->

<!-- BEGIN FILE: harness.json -->
````````json
{
  "schemaVersion": "1.0.0",
  "status": "policy-contract-not-an-enforcement-sandbox",
  "project": "tokyo-love-story",
  "permissions": {
    "localCodeEdit": true,
    "localValidation": true,
    "offlineCdkSynth": true,
    "gitCommit": false,
    "gitPush": false,
    "gitBranchSwitch": false,
    "rewriteGitHistory": false,
    "awsBootstrap": false,
    "awsDeploy": false,
    "createPaidResources": false,
    "publishPublicService": false,
    "scanRealUserData": false,
    "deleteRemoteData": false
  },
  "requiresExplicitUserAuthorization": [
    "gitCommit",
    "gitPush",
    "awsBootstrap",
    "awsDeploy",
    "createPaidResources",
    "publishPublicService",
    "scanRealUserData",
    "deleteRemoteData"
  ],
  "commandsToImplement": {
    "doctor": "pnpm doctor",
    "dev": "pnpm dev",
    "verify": "pnpm verify",
    "smoke": "pnpm test:smoke",
    "infraSynth": "pnpm infra:synth",
    "infraDiff": "pnpm infra:diff",
    "releasePlan": "pnpm release:plan",
    "releaseDeploy": "pnpm release:deploy"
  },
  "alwaysRead": [
    "AGENTS.md",
    "CONTEXT.md"
  ],
  "stagePlan": "docs/07-plan.md",
  "defaultAwsRegion": "ap-northeast-1",
  "noDefaultCloudDeployment": true
}
````````
<!-- END FILE: harness.json -->

<!-- BEGIN FILE: MANIFEST.sha256 -->
````````text
6730072e5d87e7ceb77de383a58dbdc22c12119b2354db777bfa6edd53a07a8e  AGENTS.md
7948954a81ca8361406285c7e77a7479645063139c1d6be1705f954c4b00e743  CLAUDE.md
0e02584b89a11908fb4e6c838863a8ab70980461abffa0220ef6d001b1e930da  CONTEXT.md
f42274fe9783c4f483783bdb69c66fc1caad57a466da571db3cd14e710a36716  README.md
78b8767e78ffbbc988467df7d3c71ffb1a80f76476c9f01fe58fa8060acc6a5a  bootstrap.md
f3a417885f5efb0b501b725b4635f101bc3f59dda27cd6936706471d87f5b62d  config/catalog.demo.v1.json
2532f0f81bb7a352cdce06c83eed829c4b5d5cac3007cea4a494737528cb5dd8  config/deploy.example.json
8ca59d2278ae6205c3ae917bd933478553ade63930af8fe41d8e6cfdafe78d8d  config/gitignore.example
be85d27352c06b1adba040295cbfca7819e8b22e806996f3d45b55141a4058f2  config/model.demo.v1.json
d50a39b298a369901744112785418321171374e6fc9421e36d919e2d25a2e388  contracts/domain.ts
e37b61fb5be7e56cd24066f078aac73bdc09da0e03808ea9d819da55b92eb029  docs/01-product.md
ca9895947a53e862076237c4d9ae52cc87b0db1d209a16cd637f5376f5387004  docs/02-ux.md
43ec4e76cc8adecb26a204480327c62c27034b4e72ad713ed30b2c0d93618ba3  docs/03-fields.md
2ff4539d0543284a272cd3587882b678ea6924f58a2fdb73248c48fdd276cd7c  docs/04-model.md
ff7f42e530475c59ece5599908f01c70c4f26fd33439b0c3361138de6ec8ec06  docs/05-data-api.md
7bfce3e5699762344a848e36427da0db0758a74ab8e1b61acd81561790ed2e40  docs/06-aws.md
c86ec82a06c4374c21c2a6b1868fd58ac3d01aa95ea84f981c38e203044ef1b9  docs/07-plan.md
66108b9660c274939b70b3197bfd945b52d5f97c400d055c5f0453f8185eb4d9  docs/08-acceptance.md
d61a81d0b3340406eba9aa101e625b322d319e64b3beb39f032a867c0eccb0b1  docs/09-sources-decisions.md
298834815afb04557d906566704054e7315d5ebaa3981b5df59a2f354017ff43  examples/fixtures.demo.v1.json
54e6a53116096e5bedfa8b46e8686487dfc62c6813279110c32adf173c5aa9c9  harness.json
b77efe98c01f2b4325d8715be3173c7f11cc6f58994e26861fdb4c74ec1b35cf  reference/excel-fields.md
7c342683f04290482f7d6be38d74fff7293ca03b5da4e1ee2f93359734e255f9  scripts/validate_design.py
3cf4d9ed75c80f1f19bda05f35d65ac89b5769047e64db0852926fdfdaa6e948  validation-report.json
````````
<!-- END FILE: MANIFEST.sha256 -->

<!-- BEGIN FILE: config/catalog.demo.v1.json -->
````````json
{
  "schemaVersion": "1.0.0",
  "catalogVersion": "catalog-demo-1.0.0",
  "language": "zh-CN",
  "groups": [
    {
      "id": "basic",
      "label": "基础与地区"
    },
    {
      "id": "romance",
      "label": "婚恋经历"
    },
    {
      "id": "appearance",
      "label": "外貌与身体"
    },
    {
      "id": "education",
      "label": "教育背景"
    },
    {
      "id": "career",
      "label": "职业与个人财务"
    },
    {
      "id": "lifestyle",
      "label": "性格与生活方式"
    },
    {
      "id": "family",
      "label": "原生家庭"
    },
    {
      "id": "longterm",
      "label": "健康与长期相处"
    },
    {
      "id": "types",
      "label": "类型筛选"
    }
  ],
  "common": {
    "requirementStates": [
      "any",
      "required"
    ],
    "defaultRequirement": "any",
    "ownMissingIsNotZero": true,
    "enumMultiSelectOperator": "OR",
    "betweenFieldsOperator": "AND"
  },
  "fields": [
    {
      "id": "gender",
      "label": "性别",
      "group": "basic",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "性别",
      "note": "不参与评分；不依据自身性别自动推断对方性别或性取向。",
      "options": [
        {
          "id": "female",
          "label": "女"
        },
        {
          "id": "male",
          "label": "男"
        },
        {
          "id": "other",
          "label": "其他"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "age",
      "label": "年龄",
      "group": "basic",
      "kind": "number",
      "selfControl": "number_or_preset",
      "requirementControl": "preset_or_select_range",
      "allowedOperators": [
        "gte",
        "lte",
        "between",
        "relative"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "年龄",
      "note": "初版数值支持18～100；无要求为全部成年人。101岁以上按模型尾部合并到100岁端点处理，UI须注明数值上限，不伪称真实年龄上限。",
      "unit": "岁",
      "minimum": 18,
      "maximum": 100,
      "step": 1,
      "presets": [
        {
          "label": "18～24岁",
          "op": "between",
          "min": 18,
          "max": 24
        },
        {
          "label": "25～29岁",
          "op": "between",
          "min": 25,
          "max": 29
        },
        {
          "label": "30～34岁",
          "op": "between",
          "min": 30,
          "max": 34
        },
        {
          "label": "35～39岁",
          "op": "between",
          "min": 35,
          "max": 39
        },
        {
          "label": "40～49岁",
          "op": "between",
          "min": 40,
          "max": 49
        },
        {
          "label": "50岁及以上",
          "op": "gte",
          "value": 50
        }
      ],
      "relativePresets": [
        {
          "label": "与我相差3岁以内",
          "minOffset": -3,
          "maxOffset": 3
        },
        {
          "label": "与我相差5岁以内",
          "minOffset": -5,
          "maxOffset": 5
        }
      ],
      "scoreEnabled": false
    },
    {
      "id": "nationality",
      "label": "国籍",
      "group": "basic",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "国籍",
      "note": "初版粗粒度登记国籍单选；其他不等于不适用。以后可扩充类别。不得参与高低评分。",
      "options": [
        {
          "id": "CN",
          "label": "中国"
        },
        {
          "id": "JP",
          "label": "日本"
        },
        {
          "id": "KR",
          "label": "韩国"
        },
        {
          "id": "US",
          "label": "美国"
        },
        {
          "id": "CA",
          "label": "加拿大"
        },
        {
          "id": "AU",
          "label": "澳大利亚"
        },
        {
          "id": "OTHER",
          "label": "其他"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "residence",
      "label": "现居地",
      "group": "basic",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "现居地",
      "note": "不收精确地址。宏观区域展开为互斥叶子集合，重复项去重后求和。",
      "options": [
        {
          "id": "cn_shanghai",
          "label": "中国大陆·上海"
        },
        {
          "id": "cn_jiangsu",
          "label": "中国大陆·江苏"
        },
        {
          "id": "cn_zhejiang",
          "label": "中国大陆·浙江"
        },
        {
          "id": "cn_beijing",
          "label": "中国大陆·北京"
        },
        {
          "id": "cn_guangdong",
          "label": "中国大陆·广东"
        },
        {
          "id": "cn_other",
          "label": "中国大陆·其他"
        },
        {
          "id": "jp_tokyo",
          "label": "日本·东京"
        },
        {
          "id": "jp_kanagawa",
          "label": "日本·神奈川"
        },
        {
          "id": "jp_saitama",
          "label": "日本·埼玉"
        },
        {
          "id": "jp_chiba",
          "label": "日本·千叶"
        },
        {
          "id": "jp_osaka",
          "label": "日本·大阪"
        },
        {
          "id": "jp_other",
          "label": "日本·其他"
        },
        {
          "id": "world_other",
          "label": "其他地区"
        }
      ],
      "presets": [
        {
          "id": "tokyo",
          "label": "东京",
          "values": [
            "jp_tokyo"
          ]
        },
        {
          "id": "tokyo_metro",
          "label": "一都三县",
          "values": [
            "jp_tokyo",
            "jp_kanagawa",
            "jp_saitama",
            "jp_chiba"
          ]
        },
        {
          "id": "japan",
          "label": "日本全域",
          "values": [
            "jp_tokyo",
            "jp_kanagawa",
            "jp_saitama",
            "jp_chiba",
            "jp_osaka",
            "jp_other"
          ]
        },
        {
          "id": "jiangzhehu",
          "label": "江浙沪",
          "values": [
            "cn_shanghai",
            "cn_jiangsu",
            "cn_zhejiang"
          ]
        },
        {
          "id": "mainland",
          "label": "中国大陆全域",
          "values": [
            "cn_shanghai",
            "cn_jiangsu",
            "cn_zhejiang",
            "cn_beijing",
            "cn_guangdong",
            "cn_other"
          ]
        }
      ],
      "scoreEnabled": false
    },
    {
      "id": "hukou",
      "label": "户籍",
      "group": "basic",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "户籍",
      "note": "本字段明确指中国大陆户籍；不适用是一种已回答值，不是未填写。",
      "options": [
        {
          "id": "cn_shanghai",
          "label": "上海"
        },
        {
          "id": "cn_jiangsu",
          "label": "江苏"
        },
        {
          "id": "cn_zhejiang",
          "label": "浙江"
        },
        {
          "id": "cn_beijing",
          "label": "北京"
        },
        {
          "id": "cn_guangdong",
          "label": "广东"
        },
        {
          "id": "cn_other",
          "label": "中国大陆其他"
        },
        {
          "id": "not_applicable",
          "label": "不适用：中国大陆户籍之外"
        }
      ],
      "presets": [
        {
          "id": "jiangzhehu",
          "label": "江浙沪",
          "values": [
            "cn_shanghai",
            "cn_jiangsu",
            "cn_zhejiang"
          ]
        },
        {
          "id": "mainland",
          "label": "中国大陆户籍",
          "values": [
            "cn_shanghai",
            "cn_jiangsu",
            "cn_zhejiang",
            "cn_beijing",
            "cn_guangdong",
            "cn_other"
          ]
        }
      ],
      "scoreEnabled": false
    },
    {
      "id": "marital_status",
      "label": "婚姻状况",
      "group": "basic",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "婚否",
      "note": "初始不限，不暗中筛除已婚；产品只估算，不提供撮合。",
      "options": [
        {
          "id": "never_married",
          "label": "未婚"
        },
        {
          "id": "divorced_no_children",
          "label": "离异无子女"
        },
        {
          "id": "divorced_with_children",
          "label": "离异有子女"
        },
        {
          "id": "widowed",
          "label": "丧偶"
        },
        {
          "id": "married",
          "label": "已婚"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "relationship_count",
      "label": "恋爱经历",
      "group": "romance",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "恋爱史／恋爱经历",
      "note": "",
      "options": [
        {
          "id": "zero",
          "label": "0次"
        },
        {
          "id": "one",
          "label": "1次"
        },
        {
          "id": "two_three",
          "label": "2～3次"
        },
        {
          "id": "four_plus",
          "label": "4次及以上"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "cohabitation",
      "label": "同居经历",
      "group": "romance",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "恋爱史／同居经历",
      "note": "",
      "options": [
        {
          "id": "never",
          "label": "无"
        },
        {
          "id": "past",
          "label": "曾经有"
        },
        {
          "id": "current",
          "label": "目前有"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "height_cm",
      "label": "身高",
      "group": "appearance",
      "kind": "number",
      "selfControl": "number_or_preset",
      "requirementControl": "preset_or_select_range",
      "allowedOperators": [
        "gte",
        "lte",
        "between",
        "relative"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "身高",
      "note": "不计算BMI或医疗健康分。",
      "unit": "cm",
      "minimum": 120,
      "maximum": 220,
      "step": 1,
      "presets": [
        {
          "label": "160cm及以上",
          "op": "gte",
          "value": 160
        },
        {
          "label": "170cm及以上",
          "op": "gte",
          "value": 170
        },
        {
          "label": "175cm及以上",
          "op": "gte",
          "value": 175
        },
        {
          "label": "180cm及以上",
          "op": "gte",
          "value": 180
        }
      ],
      "relativePresets": [
        {
          "label": "不低于我的身高",
          "operator": "gte",
          "offset": 0
        }
      ],
      "scoreEnabled": false
    },
    {
      "id": "weight_kg",
      "label": "体重",
      "group": "appearance",
      "kind": "number",
      "selfControl": "number_or_preset",
      "requirementControl": "preset_or_select_range",
      "allowedOperators": [
        "gte",
        "lte",
        "between"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "体重",
      "note": "不把体重机械解释为健康水平，不参与综合评分。",
      "unit": "kg",
      "minimum": 30,
      "maximum": 250,
      "step": 1,
      "presets": [
        {
          "label": "45～60kg",
          "op": "between",
          "min": 45,
          "max": 60
        },
        {
          "label": "55～75kg",
          "op": "between",
          "min": 55,
          "max": 75
        },
        {
          "label": "80kg及以下",
          "op": "lte",
          "value": 80
        }
      ],
      "relativePresets": [],
      "scoreEnabled": false
    },
    {
      "id": "appearance",
      "label": "颜值自评／要求",
      "group": "appearance",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "颜值／自评",
      "note": "主观演示档位；不上传照片、不进行AI评分。要求支持“至少X档”，展开为可接受集合。",
      "options": [
        {
          "id": "level_1",
          "label": "1档"
        },
        {
          "id": "level_2",
          "label": "2档"
        },
        {
          "id": "level_3",
          "label": "3档"
        },
        {
          "id": "level_4",
          "label": "4档"
        },
        {
          "id": "level_5",
          "label": "5档"
        }
      ],
      "presets": [],
      "scoreEnabled": true
    },
    {
      "id": "university_tier",
      "label": "院校背景",
      "group": "education",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "学校",
      "note": "仅为用户熟悉的演示分类，不宣称现代录取批次的普遍适用性；海外单列且分值是可改占位值。211与985的底层类别互斥。",
      "options": [
        {
          "id": "regular_or_below",
          "label": "二本及以下"
        },
        {
          "id": "first_tier_non211",
          "label": "一本（非211／985）"
        },
        {
          "id": "211_non985",
          "label": "211（非985）"
        },
        {
          "id": "985",
          "label": "985"
        },
        {
          "id": "overseas",
          "label": "海外院校（单列）"
        }
      ],
      "presets": [
        {
          "id": "first_tier_plus",
          "label": "一本及以上（国内分类）",
          "values": [
            "first_tier_non211",
            "211_non985",
            "985"
          ]
        },
        {
          "id": "211_plus",
          "label": "211及以上（国内分类）",
          "values": [
            "211_non985",
            "985"
          ]
        },
        {
          "id": "985_only",
          "label": "仅985",
          "values": [
            "985"
          ]
        }
      ],
      "scoreEnabled": true
    },
    {
      "id": "education",
      "label": "最高学历",
      "group": "education",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "学历",
      "note": "",
      "options": [
        {
          "id": "high_school_or_below",
          "label": "高中及以下"
        },
        {
          "id": "associate",
          "label": "专科"
        },
        {
          "id": "bachelor",
          "label": "本科"
        },
        {
          "id": "master",
          "label": "硕士"
        },
        {
          "id": "doctor",
          "label": "博士"
        }
      ],
      "presets": [
        {
          "id": "bachelor_plus",
          "label": "本科及以上",
          "values": [
            "bachelor",
            "master",
            "doctor"
          ]
        },
        {
          "id": "master_plus",
          "label": "硕士及以上",
          "values": [
            "master",
            "doctor"
          ]
        },
        {
          "id": "doctor_only",
          "label": "博士",
          "values": [
            "doctor"
          ]
        }
      ],
      "scoreEnabled": true
    },
    {
      "id": "home",
      "label": "个人名下婚房",
      "group": "career",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "个人名下婚房",
      "note": "婚房按能否用于婚后居住且个人名下定义；不推断房屋价值。",
      "options": [
        {
          "id": "none",
          "label": "无"
        },
        {
          "id": "mortgaged",
          "label": "有，尚有房贷"
        },
        {
          "id": "paid_off",
          "label": "有，已无房贷"
        }
      ],
      "presets": [],
      "scoreEnabled": true
    },
    {
      "id": "car",
      "label": "个人名下汽车",
      "group": "career",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "个人名下汽车",
      "note": "",
      "options": [
        {
          "id": "none",
          "label": "无"
        },
        {
          "id": "financed",
          "label": "有，尚有车贷"
        },
        {
          "id": "paid_off",
          "label": "有，已无车贷"
        }
      ],
      "presets": [],
      "scoreEnabled": true
    },
    {
      "id": "other_assets_cny",
      "label": "其他大额资产",
      "group": "career",
      "kind": "number",
      "selfControl": "number_or_preset",
      "requirementControl": "preset_or_select_range",
      "allowedOperators": [
        "gte",
        "lte",
        "between"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "个人名下其他大额资产",
      "note": "排除已单列的婚房、汽车和存款／证券；保存原币种和统一计算金额。",
      "unit": "CNY",
      "minimum": 0,
      "maximum": 100000000,
      "step": 1,
      "presets": [
        {
          "label": "10万元人民币及以上",
          "op": "gte",
          "value": 100000
        },
        {
          "label": "50万元人民币及以上",
          "op": "gte",
          "value": 500000
        },
        {
          "label": "100万元人民币及以上",
          "op": "gte",
          "value": 1000000
        }
      ],
      "relativePresets": [],
      "scoreEnabled": true
    },
    {
      "id": "debt_cny",
      "label": "个人名下贷款余额",
      "group": "career",
      "kind": "number",
      "selfControl": "number_or_preset",
      "requirementControl": "preset_or_select_range",
      "allowedOperators": [
        "gte",
        "lte",
        "between"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "个人名下贷款",
      "note": "包含房贷车贷；与资产相关性先不校准，不能把占位分当作专业财务评估。",
      "unit": "CNY",
      "minimum": 0,
      "maximum": 100000000,
      "step": 1,
      "presets": [
        {
          "label": "无贷款",
          "op": "lte",
          "value": 0
        },
        {
          "label": "10万元人民币以内",
          "op": "lte",
          "value": 100000
        },
        {
          "label": "50万元人民币以内",
          "op": "lte",
          "value": 500000
        }
      ],
      "relativePresets": [],
      "scoreEnabled": true
    },
    {
      "id": "occupation",
      "label": "工作类别",
      "group": "career",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "工作类别",
      "note": "不收单位名称；职业类别本身不排序评分。",
      "options": [
        {
          "id": "student",
          "label": "在读"
        },
        {
          "id": "it_engineering",
          "label": "IT／工程技术"
        },
        {
          "id": "professional",
          "label": "专业服务"
        },
        {
          "id": "education_research",
          "label": "教育／科研"
        },
        {
          "id": "public_sector",
          "label": "公共部门"
        },
        {
          "id": "business_office",
          "label": "企业职员"
        },
        {
          "id": "service_trade",
          "label": "服务／技工"
        },
        {
          "id": "self_employed",
          "label": "自由职业／自营"
        },
        {
          "id": "not_working",
          "label": "暂未工作"
        },
        {
          "id": "retired",
          "label": "退休"
        },
        {
          "id": "other",
          "label": "其他"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "annual_income_cny",
      "label": "税前年收入",
      "group": "career",
      "kind": "number",
      "selfControl": "number_or_preset",
      "requirementControl": "preset_or_select_range",
      "allowedOperators": [
        "gte",
        "lte",
        "between",
        "relative"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "薪资",
      "note": "人民币／日元可切换；统一税前年收入，不混月薪、税后收入。",
      "unit": "CNY/year",
      "minimum": 0,
      "maximum": 100000000,
      "step": 1,
      "presets": [
        {
          "label": "12万元人民币及以上",
          "op": "gte",
          "value": 120000
        },
        {
          "label": "24万元人民币及以上",
          "op": "gte",
          "value": 240000
        },
        {
          "label": "50万元人民币及以上",
          "op": "gte",
          "value": 500000
        },
        {
          "label": "100万元人民币及以上",
          "op": "gte",
          "value": 1000000
        }
      ],
      "relativePresets": [
        {
          "label": "不低于我的年收入",
          "operator": "gte",
          "offset": 0
        }
      ],
      "scoreEnabled": true
    },
    {
      "id": "job_stability",
      "label": "职业稳定性自评",
      "group": "career",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "职业稳定性与行业风险",
      "note": "",
      "options": [
        {
          "id": "high_volatility",
          "label": "波动较大"
        },
        {
          "id": "medium",
          "label": "一般"
        },
        {
          "id": "stable",
          "label": "相对稳定"
        }
      ],
      "presets": [],
      "scoreEnabled": true
    },
    {
      "id": "career_plan",
      "label": "职业规划自评",
      "group": "career",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "个人职业规划与抗风险能力",
      "note": "",
      "options": [
        {
          "id": "exploring",
          "label": "正在探索"
        },
        {
          "id": "some_plan",
          "label": "有大致方向"
        },
        {
          "id": "clear_plan",
          "label": "有明确计划"
        }
      ],
      "presets": [],
      "scoreEnabled": true
    },
    {
      "id": "risk_buffer",
      "label": "收入中断可支撑时长",
      "group": "career",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "个人职业规划与抗风险能力",
      "note": "自评生活缓冲时间；不由存款自动推断。",
      "options": [
        {
          "id": "under_3m",
          "label": "不足3个月"
        },
        {
          "id": "3_6m",
          "label": "3～6个月"
        },
        {
          "id": "6_12m",
          "label": "6～12个月"
        },
        {
          "id": "12m_plus",
          "label": "12个月及以上"
        }
      ],
      "presets": [],
      "scoreEnabled": true
    },
    {
      "id": "financial_assets_cny",
      "label": "存款与有价证券",
      "group": "career",
      "kind": "number",
      "selfControl": "number_or_preset",
      "requirementControl": "preset_or_select_range",
      "allowedOperators": [
        "gte",
        "lte",
        "between"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "存款（含有价证券）",
      "note": "采用当前估计值；不输入账户或持仓明细。",
      "unit": "CNY",
      "minimum": 0,
      "maximum": 100000000,
      "step": 1,
      "presets": [
        {
          "label": "10万元人民币及以上",
          "op": "gte",
          "value": 100000
        },
        {
          "label": "50万元人民币及以上",
          "op": "gte",
          "value": 500000
        },
        {
          "label": "100万元人民币及以上",
          "op": "gte",
          "value": 1000000
        }
      ],
      "relativePresets": [],
      "scoreEnabled": true
    },
    {
      "id": "sociability",
      "label": "性格：内外向倾向",
      "group": "lifestyle",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "性格",
      "note": "",
      "options": [
        {
          "id": "introvert",
          "label": "偏内向"
        },
        {
          "id": "balanced",
          "label": "中间型"
        },
        {
          "id": "extrovert",
          "label": "偏外向"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "routine",
      "label": "作息习惯",
      "group": "lifestyle",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "习惯／生活习惯兼容度",
      "note": "",
      "options": [
        {
          "id": "early",
          "label": "偏早睡早起"
        },
        {
          "id": "regular",
          "label": "作息较规律"
        },
        {
          "id": "late",
          "label": "偏晚睡晚起"
        },
        {
          "id": "variable",
          "label": "不固定"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "social_frequency",
      "label": "社交频率",
      "group": "lifestyle",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "习惯",
      "note": "",
      "options": [
        {
          "id": "low",
          "label": "较少"
        },
        {
          "id": "medium",
          "label": "适中"
        },
        {
          "id": "high",
          "label": "较多"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "hobbies",
      "label": "爱好",
      "group": "lifestyle",
      "kind": "tags",
      "selfControl": "multi_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "any_of"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "爱好",
      "note": "自己可多选；对方勾选多个表示至少有其中一个爱好，不要求全部具备。",
      "options": [
        {
          "id": "sports",
          "label": "运动"
        },
        {
          "id": "reading",
          "label": "阅读"
        },
        {
          "id": "gaming",
          "label": "游戏"
        },
        {
          "id": "travel",
          "label": "旅行"
        },
        {
          "id": "music",
          "label": "音乐"
        },
        {
          "id": "cooking",
          "label": "烹饪"
        },
        {
          "id": "film",
          "label": "影视"
        },
        {
          "id": "outdoors",
          "label": "户外"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "smoking",
      "label": "吸烟情况",
      "group": "lifestyle",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "不良嗜好／烟瘾",
      "note": "",
      "options": [
        {
          "id": "none",
          "label": "不吸烟"
        },
        {
          "id": "occasional",
          "label": "偶尔"
        },
        {
          "id": "regular",
          "label": "经常"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "drinking",
      "label": "饮酒情况",
      "group": "lifestyle",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "不良嗜好／酗酒",
      "note": "不做临床诊断。",
      "options": [
        {
          "id": "none",
          "label": "不饮酒"
        },
        {
          "id": "occasional",
          "label": "偶尔"
        },
        {
          "id": "frequent",
          "label": "经常"
        },
        {
          "id": "problematic_self_report",
          "label": "自述有失控饮酒问题"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "gambling",
      "label": "赌博相关情况",
      "group": "lifestyle",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "不良嗜好／赌",
      "note": "",
      "options": [
        {
          "id": "none",
          "label": "无"
        },
        {
          "id": "past",
          "label": "过去有，目前无"
        },
        {
          "id": "current",
          "label": "目前有"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "drug_use",
      "label": "毒品使用经历",
      "group": "lifestyle",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "不良嗜好／毒",
      "note": "只收类别，不收具体违法细节；不参与评分。",
      "options": [
        {
          "id": "none",
          "label": "无"
        },
        {
          "id": "past",
          "label": "过去有，目前无"
        },
        {
          "id": "current",
          "label": "目前有"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "parents_pension_cny",
      "label": "父母养老金合计（月）",
      "group": "family",
      "kind": "number",
      "selfControl": "number_or_preset",
      "requirementControl": "preset_or_select_range",
      "allowedOperators": [
        "gte",
        "lte",
        "between"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "父母养老金",
      "note": "含公共养老金与稳定退休金；按合计月额，不适用可跳过。",
      "unit": "CNY/month",
      "minimum": 0,
      "maximum": 100000,
      "step": 1,
      "presets": [
        {
          "label": "2000元人民币及以上",
          "op": "gte",
          "value": 2000
        },
        {
          "label": "5000元人民币及以上",
          "op": "gte",
          "value": 5000
        },
        {
          "label": "1万元人民币及以上",
          "op": "gte",
          "value": 10000
        }
      ],
      "relativePresets": [],
      "scoreEnabled": false
    },
    {
      "id": "father_age",
      "label": "父亲年龄段",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "父亲／年龄段",
      "note": "",
      "options": [
        {
          "id": "under_50",
          "label": "50岁以下"
        },
        {
          "id": "50_59",
          "label": "50～59岁"
        },
        {
          "id": "60_69",
          "label": "60～69岁"
        },
        {
          "id": "70_plus",
          "label": "70岁及以上"
        },
        {
          "id": "deceased",
          "label": "已故"
        },
        {
          "id": "not_known",
          "label": "不清楚／不适用"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "father_education",
      "label": "父亲学历",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "父亲／学历",
      "note": "",
      "options": [
        {
          "id": "high_school_or_below",
          "label": "高中及以下"
        },
        {
          "id": "associate",
          "label": "专科"
        },
        {
          "id": "bachelor",
          "label": "本科"
        },
        {
          "id": "master",
          "label": "硕士"
        },
        {
          "id": "doctor",
          "label": "博士"
        },
        {
          "id": "not_known",
          "label": "不清楚／不适用"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "father_occupation",
      "label": "父亲工作类别",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "父亲／工作",
      "note": "",
      "options": [
        {
          "id": "student",
          "label": "在读"
        },
        {
          "id": "it_engineering",
          "label": "IT／工程技术"
        },
        {
          "id": "professional",
          "label": "专业服务"
        },
        {
          "id": "education_research",
          "label": "教育／科研"
        },
        {
          "id": "public_sector",
          "label": "公共部门"
        },
        {
          "id": "business_office",
          "label": "企业职员"
        },
        {
          "id": "service_trade",
          "label": "服务／技工"
        },
        {
          "id": "self_employed",
          "label": "自由职业／自营"
        },
        {
          "id": "not_working",
          "label": "暂未工作"
        },
        {
          "id": "retired",
          "label": "退休"
        },
        {
          "id": "other",
          "label": "其他"
        },
        {
          "id": "not_known",
          "label": "不清楚／不适用"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "father_marital",
      "label": "父亲婚姻情况",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "父亲／离异与否",
      "note": "",
      "options": [
        {
          "id": "married",
          "label": "已婚"
        },
        {
          "id": "divorced",
          "label": "离异"
        },
        {
          "id": "widowed",
          "label": "丧偶"
        },
        {
          "id": "other",
          "label": "其他／不适用"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "mother_age",
      "label": "母亲年龄段",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "母亲／年龄段",
      "note": "",
      "options": [
        {
          "id": "under_50",
          "label": "50岁以下"
        },
        {
          "id": "50_59",
          "label": "50～59岁"
        },
        {
          "id": "60_69",
          "label": "60～69岁"
        },
        {
          "id": "70_plus",
          "label": "70岁及以上"
        },
        {
          "id": "deceased",
          "label": "已故"
        },
        {
          "id": "not_known",
          "label": "不清楚／不适用"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "mother_education",
      "label": "母亲学历",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "母亲／学历",
      "note": "",
      "options": [
        {
          "id": "high_school_or_below",
          "label": "高中及以下"
        },
        {
          "id": "associate",
          "label": "专科"
        },
        {
          "id": "bachelor",
          "label": "本科"
        },
        {
          "id": "master",
          "label": "硕士"
        },
        {
          "id": "doctor",
          "label": "博士"
        },
        {
          "id": "not_known",
          "label": "不清楚／不适用"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "mother_occupation",
      "label": "母亲工作类别",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "母亲／工作",
      "note": "",
      "options": [
        {
          "id": "student",
          "label": "在读"
        },
        {
          "id": "it_engineering",
          "label": "IT／工程技术"
        },
        {
          "id": "professional",
          "label": "专业服务"
        },
        {
          "id": "education_research",
          "label": "教育／科研"
        },
        {
          "id": "public_sector",
          "label": "公共部门"
        },
        {
          "id": "business_office",
          "label": "企业职员"
        },
        {
          "id": "service_trade",
          "label": "服务／技工"
        },
        {
          "id": "self_employed",
          "label": "自由职业／自营"
        },
        {
          "id": "not_working",
          "label": "暂未工作"
        },
        {
          "id": "retired",
          "label": "退休"
        },
        {
          "id": "other",
          "label": "其他"
        },
        {
          "id": "not_known",
          "label": "不清楚／不适用"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "mother_marital",
      "label": "母亲婚姻情况",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "母亲／离异与否",
      "note": "",
      "options": [
        {
          "id": "married",
          "label": "已婚"
        },
        {
          "id": "divorced",
          "label": "离异"
        },
        {
          "id": "widowed",
          "label": "丧偶"
        },
        {
          "id": "other",
          "label": "其他／不适用"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "only_child",
      "label": "是否独生子女",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "是否独生子",
      "note": "",
      "options": [
        {
          "id": "yes",
          "label": "是"
        },
        {
          "id": "no",
          "label": "否"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "family_net_assets_cny",
      "label": "家庭净资产",
      "group": "family",
      "kind": "number",
      "selfControl": "number_or_preset",
      "requirementControl": "preset_or_select_range",
      "allowedOperators": [
        "gte",
        "lte",
        "between"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "家庭净资产",
      "note": "原生家庭资产减债务的粗略合计，允许为负；不参与初版评分，避免与个人资产重复排名。",
      "unit": "CNY",
      "minimum": -100000000,
      "maximum": 100000000,
      "step": 1,
      "presets": [
        {
          "label": "10万元人民币及以上",
          "op": "gte",
          "value": 100000
        },
        {
          "label": "50万元人民币及以上",
          "op": "gte",
          "value": 500000
        },
        {
          "label": "100万元人民币及以上",
          "op": "gte",
          "value": 1000000
        }
      ],
      "relativePresets": [],
      "scoreEnabled": false
    },
    {
      "id": "live_with_parents",
      "label": "婚后与父母同住意向",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "原生家庭的边界感与相处模式",
      "note": "",
      "options": [
        {
          "id": "separate",
          "label": "倾向分开居住"
        },
        {
          "id": "same_home",
          "label": "倾向同住"
        },
        {
          "id": "flexible",
          "label": "可协商"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "parent_involvement",
      "label": "父母参与重大决定的方式",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "原生家庭的边界感与相处模式",
      "note": "",
      "options": [
        {
          "id": "couple_decides",
          "label": "夫妻自主决定"
        },
        {
          "id": "consult",
          "label": "听取建议后自主决定"
        },
        {
          "id": "joint_family",
          "label": "家庭共同决定"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "family_support",
      "label": "对原生家庭经济支持安排",
      "group": "family",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "原生家庭的边界感与相处模式",
      "note": "",
      "options": [
        {
          "id": "none_regular",
          "label": "无固定支持"
        },
        {
          "id": "regular",
          "label": "有固定支持"
        },
        {
          "id": "as_needed",
          "label": "按需要协商"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "hereditary_history",
      "label": "已知遗传病史情况",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "遗传病史",
      "note": "自述类别；不收疾病名称、不推断遗传风险、不参与评分。",
      "options": [
        {
          "id": "none_known",
          "label": "无已知情况"
        },
        {
          "id": "known",
          "label": "有已知情况"
        },
        {
          "id": "unknown",
          "label": "不清楚"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "spending_style",
      "label": "消费与储蓄取向",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "三观契合度",
      "note": "不新增政治、宗教或意识形态评分。",
      "options": [
        {
          "id": "save",
          "label": "偏储蓄"
        },
        {
          "id": "balanced",
          "label": "平衡"
        },
        {
          "id": "enjoy",
          "label": "偏当下体验"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "household_roles",
      "label": "家务分工意向",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "三观契合度",
      "note": "",
      "options": [
        {
          "id": "equal",
          "label": "尽量平均"
        },
        {
          "id": "availability",
          "label": "按时间能力分工"
        },
        {
          "id": "other_agreement",
          "label": "其他协商安排"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "work_family_priority",
      "label": "工作与家庭安排",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "三观契合度",
      "note": "",
      "options": [
        {
          "id": "career",
          "label": "当前偏事业"
        },
        {
          "id": "balanced",
          "label": "两者兼顾"
        },
        {
          "id": "family",
          "label": "当前偏家庭"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "emotion_regulation",
      "label": "情绪调节自评",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "情绪稳定性与冲突处理能力",
      "note": "不是心理健康诊断。",
      "options": [
        {
          "id": "needs_time",
          "label": "常需要较长时间平复"
        },
        {
          "id": "mostly_ok",
          "label": "大多数时候能平复"
        },
        {
          "id": "steady",
          "label": "通常能稳定表达"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "conflict_style",
      "label": "冲突处理倾向",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "情绪稳定性与冲突处理能力",
      "note": "",
      "options": [
        {
          "id": "immediate_talk",
          "label": "倾向及时沟通"
        },
        {
          "id": "cool_then_talk",
          "label": "冷静后沟通"
        },
        {
          "id": "avoid",
          "label": "倾向回避"
        },
        {
          "id": "seek_help",
          "label": "必要时寻求帮助"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "credit_status",
      "label": "信用与法律履约情况",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "法律信用与债务透明度",
      "note": "不查征信，不收案件细节，不做法律判断。",
      "options": [
        {
          "id": "none_known",
          "label": "无已知异常"
        },
        {
          "id": "resolved",
          "label": "曾有异常，已处理"
        },
        {
          "id": "unresolved",
          "label": "有未处理事项"
        },
        {
          "id": "unknown",
          "label": "不清楚"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "debt_disclosure",
      "label": "债务沟通意愿",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "法律信用与债务透明度",
      "note": "",
      "options": [
        {
          "id": "open",
          "label": "愿意充分说明"
        },
        {
          "id": "before_marriage",
          "label": "确定婚姻计划前说明"
        },
        {
          "id": "limited",
          "label": "倾向有限披露"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "children_plan",
      "label": "生育意愿",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "生育观念与健康状况",
      "note": "",
      "options": [
        {
          "id": "yes",
          "label": "希望有孩子"
        },
        {
          "id": "no",
          "label": "不希望有孩子"
        },
        {
          "id": "undecided",
          "label": "尚未决定"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "children_number",
      "label": "理想子女数量",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "生育观念与健康状况",
      "note": "与生育意愿仅做输入一致性提示；初版允许该项单独不限，不额外做道德评价。",
      "options": [
        {
          "id": "zero",
          "label": "0个"
        },
        {
          "id": "one",
          "label": "1个"
        },
        {
          "id": "two",
          "label": "2个"
        },
        {
          "id": "three_plus",
          "label": "3个及以上"
        },
        {
          "id": "undecided",
          "label": "尚未决定"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "parenting_arrangement",
      "label": "育儿分工意向",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "生育观念与健康状况",
      "note": "",
      "options": [
        {
          "id": "shared",
          "label": "共同承担"
        },
        {
          "id": "availability",
          "label": "按工作情况协商"
        },
        {
          "id": "family_support",
          "label": "考虑家人协助"
        },
        {
          "id": "not_applicable",
          "label": "不适用／未决定"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "health_status",
      "label": "健康情况自述",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": true,
      "sourceItem": "生育观念与健康状况",
      "note": "不进行诊断、寿命推断或医疗建议，不参与评分。",
      "options": [
        {
          "id": "no_current_limit",
          "label": "目前无自述生活限制"
        },
        {
          "id": "managed",
          "label": "有需持续管理的状况"
        },
        {
          "id": "assistance",
          "label": "有需日常协助的状况"
        },
        {
          "id": "unknown",
          "label": "不清楚"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "cleanliness",
      "label": "整洁习惯",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "生活习惯兼容度",
      "note": "",
      "options": [
        {
          "id": "relaxed",
          "label": "较随意"
        },
        {
          "id": "regular",
          "label": "定期整理"
        },
        {
          "id": "high",
          "label": "对整洁要求较高"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "diet",
      "label": "饮食习惯",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "生活习惯兼容度",
      "note": "不推断宗教或疾病。",
      "options": [
        {
          "id": "broad",
          "label": "食物选择较广"
        },
        {
          "id": "vegetarian",
          "label": "以素食为主"
        },
        {
          "id": "specific",
          "label": "有特定饮食安排"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "pets",
      "label": "养宠物意向",
      "group": "longterm",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "生活习惯兼容度",
      "note": "",
      "options": [
        {
          "id": "yes",
          "label": "愿意／已有"
        },
        {
          "id": "no",
          "label": "不愿意"
        },
        {
          "id": "discuss",
          "label": "可协商"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "zodiac_sign",
      "label": "星座",
      "group": "types",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "星象学",
      "note": "普通类型筛选，不宣称决定适配程度；不额外收生日。",
      "options": [
        {
          "id": "z1",
          "label": "白羊"
        },
        {
          "id": "z2",
          "label": "金牛"
        },
        {
          "id": "z3",
          "label": "双子"
        },
        {
          "id": "z4",
          "label": "巨蟹"
        },
        {
          "id": "z5",
          "label": "狮子"
        },
        {
          "id": "z6",
          "label": "处女"
        },
        {
          "id": "z7",
          "label": "天秤"
        },
        {
          "id": "z8",
          "label": "天蝎"
        },
        {
          "id": "z9",
          "label": "射手"
        },
        {
          "id": "z10",
          "label": "摩羯"
        },
        {
          "id": "z11",
          "label": "水瓶"
        },
        {
          "id": "z12",
          "label": "双鱼"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "chinese_zodiac",
      "label": "生肖",
      "group": "types",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "生肖配",
      "note": "初版不与年龄推算、不开发合盘。",
      "options": [
        {
          "id": "c1",
          "label": "鼠"
        },
        {
          "id": "c2",
          "label": "牛"
        },
        {
          "id": "c3",
          "label": "虎"
        },
        {
          "id": "c4",
          "label": "兔"
        },
        {
          "id": "c5",
          "label": "龙"
        },
        {
          "id": "c6",
          "label": "蛇"
        },
        {
          "id": "c7",
          "label": "马"
        },
        {
          "id": "c8",
          "label": "羊"
        },
        {
          "id": "c9",
          "label": "猴"
        },
        {
          "id": "c10",
          "label": "鸡"
        },
        {
          "id": "c11",
          "label": "狗"
        },
        {
          "id": "c12",
          "label": "猪"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    },
    {
      "id": "mbti",
      "label": "MBTI",
      "group": "types",
      "kind": "enum",
      "selfControl": "single_choice",
      "requirementControl": "acceptable_multi_choice",
      "allowedOperators": [
        "in"
      ],
      "requiredSelf": false,
      "sensitive": false,
      "sourceItem": "MBTI匹配",
      "note": "普通类别筛选，不做临床人格评估或类型优劣评分。",
      "options": [
        {
          "id": "INTJ",
          "label": "INTJ"
        },
        {
          "id": "INTP",
          "label": "INTP"
        },
        {
          "id": "INFJ",
          "label": "INFJ"
        },
        {
          "id": "INFP",
          "label": "INFP"
        },
        {
          "id": "ISTJ",
          "label": "ISTJ"
        },
        {
          "id": "ISTP",
          "label": "ISTP"
        },
        {
          "id": "ISFJ",
          "label": "ISFJ"
        },
        {
          "id": "ISFP",
          "label": "ISFP"
        },
        {
          "id": "ENTJ",
          "label": "ENTJ"
        },
        {
          "id": "ENTP",
          "label": "ENTP"
        },
        {
          "id": "ENFJ",
          "label": "ENFJ"
        },
        {
          "id": "ENFP",
          "label": "ENFP"
        },
        {
          "id": "ESTJ",
          "label": "ESTJ"
        },
        {
          "id": "ESTP",
          "label": "ESTP"
        },
        {
          "id": "ESFJ",
          "label": "ESFJ"
        },
        {
          "id": "ESFP",
          "label": "ESFP"
        },
        {
          "id": "unknown",
          "label": "未测／不清楚"
        }
      ],
      "presets": [],
      "scoreEnabled": false
    }
  ]
}
````````
<!-- END FILE: config/catalog.demo.v1.json -->

<!-- BEGIN FILE: config/deploy.example.json -->
````````json
{
  "project": "tokyo-love-story",
  "stage": "prod",
  "aws": {
    "accountId": null,
    "profile": null,
    "region": "ap-northeast-1"
  },
  "domain": {
    "name": null,
    "acmCertificateArn": null,
    "certificateRegion": "us-east-1"
  },
  "cloudfront": {
    "pricingMode": "pay-as-you-go",
    "apiCachingEnabled": false,
    "privateS3Origin": true,
    "hashRouting": true
  },
  "lambda": {
    "runtime": "nodejs24.x",
    "architecture": "arm64",
    "memoryMiB": 256,
    "timeoutSeconds": 5,
    "reservedConcurrency": 5,
    "vpcEnabled": false
  },
  "api": {
    "stageRatePerSecond": 10,
    "stageBurst": 20,
    "createRatePerSecond": 2,
    "createBurst": 5,
    "maxBodyKiB": 64
  },
  "records": {
    "billingMode": "PAY_PER_REQUEST",
    "ttlAttribute": "expiresAt",
    "retentionCalendarYears": 1,
    "retentionStart": "first-server-create",
    "extendOnUpdate": false,
    "publicReadEnabled": false,
    "pointInTimeRecovery": false
  },
  "autosave": {
    "debounceMs": 1500,
    "normalMinIntervalMs": 10000,
    "maxWaitMs": 30000,
    "maxInFlightPerRecord": 1
  },
  "logging": {
    "retentionDays": 14,
    "logPayload": false,
    "logAuthorization": false,
    "cloudfrontStandardLogs": false
  },
  "budget": {
    "alertEmail": null,
    "suggestedUsdThresholds": [
      5,
      10,
      20
    ],
    "isHardSpendingCap": false
  },
  "release": {
    "allowDeploy": false,
    "requireCurrentUserAuthorization": true
  }
}
````````
<!-- END FILE: config/deploy.example.json -->

<!-- BEGIN FILE: config/gitignore.example -->
````````text
node_modules/
dist/
cdk.out/
coverage/
.local-data/
.env
.env.*
!.env.example
*.log
playwright-report/
test-results/
````````
<!-- END FILE: config/gitignore.example -->

<!-- BEGIN FILE: config/model.demo.v1.json -->
````````json
{
  "schemaVersion": "1.0.0",
  "modelVersion": "model-demo-1.0.0",
  "catalogVersion": "catalog-demo-1.0.0",
  "status": "synthetic-demo",
  "notPopulationStatistics": true,
  "source": {
    "kind": "designer-placeholder",
    "description": "为功能开发设定的演示参数；未做人口统计验证，不得标注为权威数据。",
    "url": null,
    "asOf": null
  },
  "basePopulation": 8000000000,
  "adultFraction": 0.7,
  "adultFractionStatus": "synthetic-demo",
  "currency": {
    "base": "CNY",
    "demoCnyPerUnit": {
      "CNY": 1,
      "JPY": 0.05
    },
    "status": "synthetic-demo-not-current-fx",
    "rateVersion": "fx-demo-1.0.0"
  },
  "probabilityModel": "independent-fields-v1",
  "scoreAggregation": "weighted-mean-over-present-scorable-fields",
  "requirementScoreProjection": "minimum-score-in-accepted-set",
  "fields": {
    "gender": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "female": 0.495,
          "male": 0.495,
          "other": 0.01
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "age": {
      "distribution": {
        "kind": "bucket_uniform_discrete",
        "buckets": [
          {
            "from": 18,
            "toExclusive": 25,
            "mass": 0.14
          },
          {
            "from": 25,
            "toExclusive": 30,
            "mass": 0.12
          },
          {
            "from": 30,
            "toExclusive": 35,
            "mass": 0.12
          },
          {
            "from": 35,
            "toExclusive": 40,
            "mass": 0.11
          },
          {
            "from": 40,
            "toExclusive": 50,
            "mass": 0.18
          },
          {
            "from": 50,
            "toExclusive": 65,
            "mass": 0.2
          },
          {
            "from": 65,
            "toExclusive": 101,
            "mass": 0.13
          }
        ]
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "nationality": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "CN": 0.18,
          "JP": 0.016,
          "KR": 0.006,
          "US": 0.045,
          "CA": 0.005,
          "AU": 0.004,
          "OTHER": 0.744
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "residence": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "cn_shanghai": 0.003,
          "cn_jiangsu": 0.01,
          "cn_zhejiang": 0.008,
          "cn_beijing": 0.003,
          "cn_guangdong": 0.015,
          "cn_other": 0.141,
          "jp_tokyo": 0.002,
          "jp_kanagawa": 0.001,
          "jp_saitama": 0.001,
          "jp_chiba": 0.001,
          "jp_osaka": 0.001,
          "jp_other": 0.01,
          "world_other": 0.804
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "hukou": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "cn_shanghai": 0.003,
          "cn_jiangsu": 0.01,
          "cn_zhejiang": 0.008,
          "cn_beijing": 0.003,
          "cn_guangdong": 0.015,
          "cn_other": 0.141,
          "not_applicable": 0.82
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "marital_status": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "never_married": 0.36,
          "divorced_no_children": 0.05,
          "divorced_with_children": 0.06,
          "widowed": 0.06,
          "married": 0.47
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "relationship_count": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "zero": 0.15,
          "one": 0.3,
          "two_three": 0.4,
          "four_plus": 0.15
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "cohabitation": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "never": 0.55,
          "past": 0.3,
          "current": 0.15
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "height_cm": {
      "distribution": {
        "kind": "bucket_uniform_discrete",
        "buckets": [
          {
            "from": 120,
            "toExclusive": 150,
            "mass": 0.04
          },
          {
            "from": 150,
            "toExclusive": 160,
            "mass": 0.21
          },
          {
            "from": 160,
            "toExclusive": 170,
            "mass": 0.35
          },
          {
            "from": 170,
            "toExclusive": 180,
            "mass": 0.29
          },
          {
            "from": 180,
            "toExclusive": 190,
            "mass": 0.1
          },
          {
            "from": 190,
            "toExclusive": 221,
            "mass": 0.01
          }
        ]
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "weight_kg": {
      "distribution": {
        "kind": "bucket_uniform_discrete",
        "buckets": [
          {
            "from": 30,
            "toExclusive": 45,
            "mass": 0.05
          },
          {
            "from": 45,
            "toExclusive": 55,
            "mass": 0.2
          },
          {
            "from": 55,
            "toExclusive": 65,
            "mass": 0.3
          },
          {
            "from": 65,
            "toExclusive": 80,
            "mass": 0.28
          },
          {
            "from": 80,
            "toExclusive": 100,
            "mass": 0.12
          },
          {
            "from": 100,
            "toExclusive": 251,
            "mass": 0.05
          }
        ]
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "appearance": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "level_1": 0.1,
          "level_2": 0.2,
          "level_3": 0.4,
          "level_4": 0.25,
          "level_5": 0.05
        }
      },
      "score": {
        "kind": "category_map",
        "weight": 1,
        "values": {
          "level_1": 20,
          "level_2": 40,
          "level_3": 60,
          "level_4": 80,
          "level_5": 100
        }
      }
    },
    "university_tier": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "regular_or_below": 0.9,
          "first_tier_non211": 0.065,
          "211_non985": 0.02,
          "985": 0.01,
          "overseas": 0.005
        }
      },
      "score": {
        "kind": "category_map",
        "weight": 1,
        "values": {
          "regular_or_below": 30,
          "first_tier_non211": 60,
          "211_non985": 75,
          "985": 90,
          "overseas": 60
        }
      }
    },
    "education": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "high_school_or_below": 0.6,
          "associate": 0.15,
          "bachelor": 0.21,
          "master": 0.035,
          "doctor": 0.005
        }
      },
      "score": {
        "kind": "category_map",
        "weight": 1,
        "values": {
          "high_school_or_below": 20,
          "associate": 40,
          "bachelor": 60,
          "master": 80,
          "doctor": 100
        }
      }
    },
    "home": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "none": 0.65,
          "mortgaged": 0.25,
          "paid_off": 0.1
        }
      },
      "score": {
        "kind": "category_map",
        "weight": 1,
        "values": {
          "none": 20,
          "mortgaged": 65,
          "paid_off": 90
        }
      }
    },
    "car": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "none": 0.55,
          "financed": 0.2,
          "paid_off": 0.25
        }
      },
      "score": {
        "kind": "category_map",
        "weight": 1,
        "values": {
          "none": 20,
          "financed": 60,
          "paid_off": 80
        }
      }
    },
    "other_assets_cny": {
      "distribution": {
        "kind": "bucket_uniform_discrete",
        "buckets": [
          {
            "from": 0,
            "toExclusive": 10000,
            "mass": 0.35
          },
          {
            "from": 10000,
            "toExclusive": 100000,
            "mass": 0.3
          },
          {
            "from": 100000,
            "toExclusive": 500000,
            "mass": 0.2
          },
          {
            "from": 500000,
            "toExclusive": 1000000,
            "mass": 0.08
          },
          {
            "from": 1000000,
            "toExclusive": 5000000,
            "mass": 0.06
          },
          {
            "from": 5000000,
            "toExclusive": 100000001,
            "mass": 0.01
          }
        ]
      },
      "score": {
        "kind": "piecewise_linear",
        "weight": 1,
        "knots": [
          {
            "value": 0,
            "score": 0
          },
          {
            "value": 10000,
            "score": 20
          },
          {
            "value": 100000,
            "score": 40
          },
          {
            "value": 500000,
            "score": 65
          },
          {
            "value": 1000000,
            "score": 80
          },
          {
            "value": 5000000,
            "score": 95
          },
          {
            "value": 100000000,
            "score": 100
          }
        ]
      }
    },
    "debt_cny": {
      "distribution": {
        "kind": "bucket_uniform_discrete",
        "buckets": [
          {
            "from": 0,
            "toExclusive": 1,
            "mass": 0.45
          },
          {
            "from": 1,
            "toExclusive": 100000,
            "mass": 0.2
          },
          {
            "from": 100000,
            "toExclusive": 500000,
            "mass": 0.2
          },
          {
            "from": 500000,
            "toExclusive": 1000000,
            "mass": 0.1
          },
          {
            "from": 1000000,
            "toExclusive": 100000001,
            "mass": 0.05
          }
        ]
      },
      "score": {
        "kind": "piecewise_linear",
        "weight": 1,
        "knots": [
          {
            "value": 0,
            "score": 100
          },
          {
            "value": 100000,
            "score": 80
          },
          {
            "value": 500000,
            "score": 60
          },
          {
            "value": 1000000,
            "score": 40
          },
          {
            "value": 100000000,
            "score": 0
          }
        ]
      }
    },
    "occupation": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "student": 0.09090909090909091,
          "it_engineering": 0.09090909090909091,
          "professional": 0.09090909090909091,
          "education_research": 0.09090909090909091,
          "public_sector": 0.09090909090909091,
          "business_office": 0.09090909090909091,
          "service_trade": 0.09090909090909091,
          "self_employed": 0.09090909090909091,
          "not_working": 0.09090909090909091,
          "retired": 0.09090909090909091,
          "other": 0.09090909090909091
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "annual_income_cny": {
      "distribution": {
        "kind": "bucket_uniform_discrete",
        "buckets": [
          {
            "from": 0,
            "toExclusive": 60000,
            "mass": 0.5
          },
          {
            "from": 60000,
            "toExclusive": 120000,
            "mass": 0.25
          },
          {
            "from": 120000,
            "toExclusive": 240000,
            "mass": 0.15
          },
          {
            "from": 240000,
            "toExclusive": 500000,
            "mass": 0.07
          },
          {
            "from": 500000,
            "toExclusive": 1000000,
            "mass": 0.025
          },
          {
            "from": 1000000,
            "toExclusive": 100000001,
            "mass": 0.005
          }
        ]
      },
      "score": {
        "kind": "piecewise_linear",
        "weight": 1,
        "knots": [
          {
            "value": 0,
            "score": 0
          },
          {
            "value": 60000,
            "score": 30
          },
          {
            "value": 120000,
            "score": 50
          },
          {
            "value": 240000,
            "score": 70
          },
          {
            "value": 500000,
            "score": 90
          },
          {
            "value": 1000000,
            "score": 100
          },
          {
            "value": 100000000,
            "score": 100
          }
        ]
      }
    },
    "job_stability": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "high_volatility": 0.25,
          "medium": 0.5,
          "stable": 0.25
        }
      },
      "score": {
        "kind": "category_map",
        "weight": 1,
        "values": {
          "high_volatility": 30,
          "medium": 60,
          "stable": 85
        }
      }
    },
    "career_plan": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "exploring": 0.3333333333333333,
          "some_plan": 0.3333333333333333,
          "clear_plan": 0.3333333333333333
        }
      },
      "score": {
        "kind": "category_map",
        "weight": 1,
        "values": {
          "exploring": 40,
          "some_plan": 60,
          "clear_plan": 80
        }
      }
    },
    "risk_buffer": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "under_3m": 0.35,
          "3_6m": 0.3,
          "6_12m": 0.2,
          "12m_plus": 0.15
        }
      },
      "score": {
        "kind": "category_map",
        "weight": 1,
        "values": {
          "under_3m": 20,
          "3_6m": 45,
          "6_12m": 70,
          "12m_plus": 90
        }
      }
    },
    "financial_assets_cny": {
      "distribution": {
        "kind": "bucket_uniform_discrete",
        "buckets": [
          {
            "from": 0,
            "toExclusive": 10000,
            "mass": 0.35
          },
          {
            "from": 10000,
            "toExclusive": 100000,
            "mass": 0.3
          },
          {
            "from": 100000,
            "toExclusive": 500000,
            "mass": 0.2
          },
          {
            "from": 500000,
            "toExclusive": 1000000,
            "mass": 0.08
          },
          {
            "from": 1000000,
            "toExclusive": 5000000,
            "mass": 0.06
          },
          {
            "from": 5000000,
            "toExclusive": 100000001,
            "mass": 0.01
          }
        ]
      },
      "score": {
        "kind": "piecewise_linear",
        "weight": 1,
        "knots": [
          {
            "value": 0,
            "score": 0
          },
          {
            "value": 10000,
            "score": 20
          },
          {
            "value": 100000,
            "score": 40
          },
          {
            "value": 500000,
            "score": 65
          },
          {
            "value": 1000000,
            "score": 80
          },
          {
            "value": 5000000,
            "score": 95
          },
          {
            "value": 100000000,
            "score": 100
          }
        ]
      }
    },
    "sociability": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "introvert": 0.35,
          "balanced": 0.4,
          "extrovert": 0.25
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "routine": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "early": 0.2,
          "regular": 0.4,
          "late": 0.25,
          "variable": 0.15
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "social_frequency": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "low": 0.3333333333333333,
          "medium": 0.3333333333333333,
          "high": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "hobbies": {
      "distribution": {
        "kind": "independent_tags",
        "mass": {
          "sports": 0.4,
          "reading": 0.35,
          "gaming": 0.35,
          "travel": 0.5,
          "music": 0.5,
          "cooking": 0.3,
          "film": 0.5,
          "outdoors": 0.3
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "smoking": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "none": 0.65,
          "occasional": 0.15,
          "regular": 0.2
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "drinking": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "none": 0.35,
          "occasional": 0.5,
          "frequent": 0.12,
          "problematic_self_report": 0.03
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "gambling": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "none": 0.9,
          "past": 0.07,
          "current": 0.03
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "drug_use": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "none": 0.97,
          "past": 0.02,
          "current": 0.01
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "parents_pension_cny": {
      "distribution": {
        "kind": "bucket_uniform_discrete",
        "buckets": [
          {
            "from": 0,
            "toExclusive": 1,
            "mass": 0.25
          },
          {
            "from": 1,
            "toExclusive": 2000,
            "mass": 0.3
          },
          {
            "from": 2000,
            "toExclusive": 5000,
            "mass": 0.25
          },
          {
            "from": 5000,
            "toExclusive": 10000,
            "mass": 0.15
          },
          {
            "from": 10000,
            "toExclusive": 100001,
            "mass": 0.05
          }
        ]
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "father_age": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "under_50": 0.16666666666666666,
          "50_59": 0.16666666666666666,
          "60_69": 0.16666666666666666,
          "70_plus": 0.16666666666666666,
          "deceased": 0.16666666666666666,
          "not_known": 0.16666666666666666
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "father_education": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "high_school_or_below": 0.16666666666666666,
          "associate": 0.16666666666666666,
          "bachelor": 0.16666666666666666,
          "master": 0.16666666666666666,
          "doctor": 0.16666666666666666,
          "not_known": 0.16666666666666666
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "father_occupation": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "student": 0.08333333333333333,
          "it_engineering": 0.08333333333333333,
          "professional": 0.08333333333333333,
          "education_research": 0.08333333333333333,
          "public_sector": 0.08333333333333333,
          "business_office": 0.08333333333333333,
          "service_trade": 0.08333333333333333,
          "self_employed": 0.08333333333333333,
          "not_working": 0.08333333333333333,
          "retired": 0.08333333333333333,
          "other": 0.08333333333333333,
          "not_known": 0.08333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "father_marital": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "married": 0.25,
          "divorced": 0.25,
          "widowed": 0.25,
          "other": 0.25
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "mother_age": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "under_50": 0.16666666666666666,
          "50_59": 0.16666666666666666,
          "60_69": 0.16666666666666666,
          "70_plus": 0.16666666666666666,
          "deceased": 0.16666666666666666,
          "not_known": 0.16666666666666666
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "mother_education": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "high_school_or_below": 0.16666666666666666,
          "associate": 0.16666666666666666,
          "bachelor": 0.16666666666666666,
          "master": 0.16666666666666666,
          "doctor": 0.16666666666666666,
          "not_known": 0.16666666666666666
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "mother_occupation": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "student": 0.08333333333333333,
          "it_engineering": 0.08333333333333333,
          "professional": 0.08333333333333333,
          "education_research": 0.08333333333333333,
          "public_sector": 0.08333333333333333,
          "business_office": 0.08333333333333333,
          "service_trade": 0.08333333333333333,
          "self_employed": 0.08333333333333333,
          "not_working": 0.08333333333333333,
          "retired": 0.08333333333333333,
          "other": 0.08333333333333333,
          "not_known": 0.08333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "mother_marital": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "married": 0.25,
          "divorced": 0.25,
          "widowed": 0.25,
          "other": 0.25
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "only_child": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "yes": 0.35,
          "no": 0.65
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "family_net_assets_cny": {
      "distribution": {
        "kind": "bucket_uniform_discrete",
        "buckets": [
          {
            "from": -100000000,
            "toExclusive": 0,
            "mass": 0.05
          },
          {
            "from": 0,
            "toExclusive": 100000,
            "mass": 0.3
          },
          {
            "from": 100000,
            "toExclusive": 500000,
            "mass": 0.3
          },
          {
            "from": 500000,
            "toExclusive": 1000000,
            "mass": 0.18
          },
          {
            "from": 1000000,
            "toExclusive": 5000000,
            "mass": 0.15
          },
          {
            "from": 5000000,
            "toExclusive": 100000001,
            "mass": 0.02
          }
        ]
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "live_with_parents": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "separate": 0.3333333333333333,
          "same_home": 0.3333333333333333,
          "flexible": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "parent_involvement": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "couple_decides": 0.3333333333333333,
          "consult": 0.3333333333333333,
          "joint_family": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "family_support": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "none_regular": 0.3333333333333333,
          "regular": 0.3333333333333333,
          "as_needed": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "hereditary_history": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "none_known": 0.8,
          "known": 0.05,
          "unknown": 0.15
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "spending_style": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "save": 0.3333333333333333,
          "balanced": 0.3333333333333333,
          "enjoy": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "household_roles": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "equal": 0.3333333333333333,
          "availability": 0.3333333333333333,
          "other_agreement": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "work_family_priority": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "career": 0.3333333333333333,
          "balanced": 0.3333333333333333,
          "family": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "emotion_regulation": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "needs_time": 0.3333333333333333,
          "mostly_ok": 0.3333333333333333,
          "steady": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "conflict_style": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "immediate_talk": 0.25,
          "cool_then_talk": 0.25,
          "avoid": 0.25,
          "seek_help": 0.25
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "credit_status": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "none_known": 0.25,
          "resolved": 0.25,
          "unresolved": 0.25,
          "unknown": 0.25
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "debt_disclosure": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "open": 0.3333333333333333,
          "before_marriage": 0.3333333333333333,
          "limited": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "children_plan": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "yes": 0.3333333333333333,
          "no": 0.3333333333333333,
          "undecided": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "children_number": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "zero": 0.2,
          "one": 0.2,
          "two": 0.2,
          "three_plus": 0.2,
          "undecided": 0.2
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "parenting_arrangement": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "shared": 0.25,
          "availability": 0.25,
          "family_support": 0.25,
          "not_applicable": 0.25
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "health_status": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "no_current_limit": 0.25,
          "managed": 0.25,
          "assistance": 0.25,
          "unknown": 0.25
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "cleanliness": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "relaxed": 0.3333333333333333,
          "regular": 0.3333333333333333,
          "high": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "diet": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "broad": 0.3333333333333333,
          "vegetarian": 0.3333333333333333,
          "specific": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "pets": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "yes": 0.3333333333333333,
          "no": 0.3333333333333333,
          "discuss": 0.3333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "zodiac_sign": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "z1": 0.08333333333333333,
          "z2": 0.08333333333333333,
          "z3": 0.08333333333333333,
          "z4": 0.08333333333333333,
          "z5": 0.08333333333333333,
          "z6": 0.08333333333333333,
          "z7": 0.08333333333333333,
          "z8": 0.08333333333333333,
          "z9": 0.08333333333333333,
          "z10": 0.08333333333333333,
          "z11": 0.08333333333333333,
          "z12": 0.08333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "chinese_zodiac": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "c1": 0.08333333333333333,
          "c2": 0.08333333333333333,
          "c3": 0.08333333333333333,
          "c4": 0.08333333333333333,
          "c5": 0.08333333333333333,
          "c6": 0.08333333333333333,
          "c7": 0.08333333333333333,
          "c8": 0.08333333333333333,
          "c9": 0.08333333333333333,
          "c10": 0.08333333333333333,
          "c11": 0.08333333333333333,
          "c12": 0.08333333333333333
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    },
    "mbti": {
      "distribution": {
        "kind": "categorical",
        "mass": {
          "INTJ": 0.058823529411764705,
          "INTP": 0.058823529411764705,
          "INFJ": 0.058823529411764705,
          "INFP": 0.058823529411764705,
          "ISTJ": 0.058823529411764705,
          "ISTP": 0.058823529411764705,
          "ISFJ": 0.058823529411764705,
          "ISFP": 0.058823529411764705,
          "ENTJ": 0.058823529411764705,
          "ENTP": 0.058823529411764705,
          "ENFJ": 0.058823529411764705,
          "ENFP": 0.058823529411764705,
          "ESTJ": 0.058823529411764705,
          "ESTP": 0.058823529411764705,
          "ESFJ": 0.058823529411764705,
          "ESFP": 0.058823529411764705,
          "unknown": 0.058823529411764705
        }
      },
      "score": {
        "kind": "excluded",
        "weight": 0
      }
    }
  }
}
````````
<!-- END FILE: config/model.demo.v1.json -->

<!-- BEGIN FILE: contracts/domain.ts -->
````````typescript
/** Reference contracts for implementation; no runtime or deployment side effects. */
export type FieldId =
  'gender'
  | 'age'
  | 'nationality'
  | 'residence'
  | 'hukou'
  | 'marital_status'
  | 'relationship_count'
  | 'cohabitation'
  | 'height_cm'
  | 'weight_kg'
  | 'appearance'
  | 'university_tier'
  | 'education'
  | 'home'
  | 'car'
  | 'other_assets_cny'
  | 'debt_cny'
  | 'occupation'
  | 'annual_income_cny'
  | 'job_stability'
  | 'career_plan'
  | 'risk_buffer'
  | 'financial_assets_cny'
  | 'sociability'
  | 'routine'
  | 'social_frequency'
  | 'hobbies'
  | 'smoking'
  | 'drinking'
  | 'gambling'
  | 'drug_use'
  | 'parents_pension_cny'
  | 'father_age'
  | 'father_education'
  | 'father_occupation'
  | 'father_marital'
  | 'mother_age'
  | 'mother_education'
  | 'mother_occupation'
  | 'mother_marital'
  | 'only_child'
  | 'family_net_assets_cny'
  | 'live_with_parents'
  | 'parent_involvement'
  | 'family_support'
  | 'hereditary_history'
  | 'spending_style'
  | 'household_roles'
  | 'work_family_priority'
  | 'emotion_regulation'
  | 'conflict_style'
  | 'credit_status'
  | 'debt_disclosure'
  | 'children_plan'
  | 'children_number'
  | 'parenting_arrangement'
  | 'health_status'
  | 'cleanliness'
  | 'diet'
  | 'pets'
  | 'zodiac_sign'
  | 'chinese_zodiac'
  | 'mbti';

export type Scalar = number | string;
export type OwnAnswer =
  | { state: 'answered'; value: Scalar | string[] }
  | { state: 'skipped' };
export type Predicate =
  | { op: 'in'; values: string[] }
  | { op: 'any_of'; values: string[] }
  | { op: 'gte' | 'lte'; value: number }
  | { op: 'between'; min: number; max: number }
  | { op: 'relative'; sourceField: FieldId; comparison: 'gte' | 'lte'; offset: number }
  | { op: 'relative'; sourceField: FieldId; comparison: 'between'; minOffset: number; maxOffset: number };
export type Requirement =
  | { state: 'any' }
  | { state: 'required'; predicate: Predicate };
export interface CurrencyInput {
  originalValue: number;
  currency: 'CNY' | 'JPY';
  normalizedCny: number;
  fxVersion: string;
}
export interface InputIssue {
  fieldId: FieldId;
  code: 'missing_relative_source' | 'invalid_range' | 'invalid_value' | 'version_mismatch';
  message: string;
}
export interface NormalizedInput {
  own: Partial<Record<FieldId, OwnAnswer>>;
  requirements: Partial<Record<FieldId, Requirement>>;
  currencyInputs: Partial<Record<FieldId, CurrencyInput>>;
}
export interface ModelContext {
  catalogVersion: string;
  modelVersion: string;
  fxVersion: string;
}
export interface ExpectedCount {
  expectedApprox: number | null;
  log10Expected: number | null; // null only for true zero, never JSON -Infinity
  isMathematicalZero: boolean;
}
export interface PopulationResult extends ExpectedCount {
  partial: boolean;
  issues: InputIssue[];
  trace: Array<{ fieldId: FieldId | '__adult__'; coefficient: number; before: ExpectedCount; after: ExpectedCount }>;
  modelVersion: string;
  dataStatus: 'synthetic-demo' | 'researched';
}
export interface ScoreResult {
  score: number | null;
  presentScorableCount: number;
  totalScorableCount: number;
  weightSum: number;
  contributions: Array<{ fieldId: FieldId; score: number; weight: number }>;
}
export interface Relaxation {
  fieldId: FieldId;
  original: Requirement;
  proposed: Requirement;
  label: string;
  before: ExpectedCount;
  after: ExpectedCount;
}
export interface SnapshotInput extends NormalizedInput, ModelContext {
  schemaVersion: '1.0.0';
  state: 'draft' | 'completed';
  noticeVersion: string;
}
export interface SaveRequest extends SnapshotInput {
  recordId: string;
  revision: number;
  // bearer token only in Authorization header, NOT serialized here.
}
export interface SnapshotComputed extends SnapshotInput {
  result: PopulationResult;
  scores: { own: ScoreResult; requirements: ScoreResult };
}
export interface SaveAck {
  recordId: string;
  acceptedRevision: number;
  savedAt: string;
  expiresAt: number;
  computedSummary: { expected: ExpectedCount; ownScore: number | null; requirementsScore: number | null };
}
export interface PopulationEstimator {
  estimate(input: NormalizedInput, context: ModelContext): PopulationResult;
}
export interface UnifiedScoreModel {
  scoreOwn(input: NormalizedInput, context: ModelContext): ScoreResult;
  scoreRequirements(input: NormalizedInput, context: ModelContext): ScoreResult;
}
export interface AcceptanceEstimator {
  estimate(input: NormalizedInput, context: ModelContext):
    | { status: 'not_implemented' }
    | { status: 'estimated'; acceptanceModelVersion: string; mutualExpected: number | null; notes: string[] };
}
export interface PublicRecordStore {
  create(input: SaveRequest, managementToken: string): Promise<SaveAck>;
  replace(input: SaveRequest, managementToken: string): Promise<SaveAck>;
  delete(recordId: string, managementToken: string): Promise<void>;
  // Deliberately no list/get/export on the public API.
}
````````
<!-- END FILE: contracts/domain.ts -->

<!-- BEGIN FILE: docs/01-product.md -->
````````markdown
# 01｜产品需求基线

版本：1.0.0 · 日期：2026-09-26 · 工作名：东京·爱情故事 · 工程名：tokyo-love-story。

本文件与已确认对话共同定义首版范围。中文名称来自上传的 Excel，作为可配置工作名，不表示已做商标或同名作品排查。范围或行为变化须先记录决策，不由 Agent 自行扩展。

## 1. 产品目标

让成年人通过逐项填写自身情况、选择对另一半的要求，看到符合条件的候选人口估计如何缩小。不是征婚平台，没有真实对象库、匹配推荐、身份展示或聊天。目标是理解条件叠加的影响；不得通过额外惩罚系数、羞辱文案或虚构统计人为制造零结果。

使用者优先为在日华人和中国大陆中文用户，未来可覆盖全球中文用户。使用中文界面不限制候选国籍；国籍、现居地、中国大陆户籍分别筛选。简体中文首发，不加多语言切换。

## 2. 已锁定功能

| ID | 要求 |
|---|---|
| FR-01 | PC 与手机响应式网页；日本网络环境可用。大陆另请用户测试，不作为首发门槛。 |
| FR-02 | 开场显示候选 8,000,000,000 人，是固定演示基数。点击开始后显式应用成年人基础系数。 |
| FR-03 | 每个字段先呈现“我的情况”，再呈现“对方要求”；自身非计算必需的信息允许跳过。 |
| FR-04 | 对方尽量用按钮、多选、预设门槛、可选端点完成，不依赖手输数字或长文本。 |
| FR-05 | 每项只有无要求和有要求。有要求即硬筛选，全部启用项同时满足。没有软偏好、优先或必要性另一个开关。 |
| FR-06 | 各类别内的多选表示 OR，不同字段为 AND；重叠地域和院校预设先展开并去重。 |
| FR-07 | 剩余人数始终可见；选择后立即本机重算；稀缺图表、选项比例同步更新。 |
| FR-08 | 同一评分函数、同一分值配置分别计算自身条件分与对方要求分。评分不再次乘进候选人数。 |
| FR-09 | 初版使用固定演示系数，允许粗糙；参数可替换、带版本，不把占位值伪装为真实统计。 |
| FR-10 | 数字与解释中性；正的小数显示不足一人，不证明现实不存在符合者。 |
| FR-11 | 结果页比较单项放宽，其他条件保持不变；先预览再应用。 |
| FR-12 | 完整纵向 PNG 结果卡片，支持预览与隐藏字段；自身详细信息默认不导出。 |
| FR-13 | 无登录，默认匿名上传完整快照；草稿、完成状态分开；同一测试反复修改更新同一记录。 |
| FR-14 | 一条记录自首次云端创建起保留一个公历年，不因编辑延长；到期业务失效并安排自动清理。 |
| FR-15 | 自动本机草稿、刷新恢复、上传失败提示与重试；服务故障不能阻止本机计算和导图。 |
| FR-16 | 首版没有公开记录列表、记录检索、他人记录读取、管理后台。 |
| FR-17 | 保留未来双向接受度接口；首版明确未启用，不用双方分差替代双向接受概率。 |

## 3. 三个独立引擎

`PopulationEstimator` 估计符合要求的人数；`ScoreModel` 为两侧同标评分；`AcceptanceEstimator` 是未来独立扩展。前两者首版实现，后者仅类型、注册点与 `not_implemented` 状态。不得调用 LLM/Bedrock 来计算本版分数或人数。

## 4. 条件与填写语义

- 所有可选要求初始为“无要求”。选具体值后自动启用；点击无要求后移出过滤，可保留上次选择供重新启用。
- 自身跳过、不愿透露和对方无要求不是同一个状态。已回答“不清楚”或“不适用”可以是合法类别，不能当作零值。
- 固定门槛不要求用户先填写自身对应值。只有“与我相差X岁”“不低于我的收入”等相对要求依赖自身值。
- 缺失相对条件依赖时，显示“待补充，尚未计入”，人数标注为阶段性结果；不得悄悄忽略并允许宣称全部要求已满足。
- 成年人是不可取消的范围。开场80亿不是已经筛完成年人的人数。自身年龄填写小于18无效，页面开始按钮说明仅供成年人。
- 一次测试可以只填写部分自身信息。完成按钮不要求全部答题；有未解决的格式错误/相对条件时不能标成已完成。
- 自身和要求不是互相强制一致：用户可以没有婚房但要求对方有房，不自动纠正或处罚。

## 5. 数据与信息最小化

只收结构化填写项、要求与必要技术元数据。不收姓名、昵称、电话、邮箱、照片、精确地址、雇主名称、身份证、账户明细、病历或自由长文本。不根据IP猜用户地区，不做设备指纹、跨设备去重、分析追踪SDK。

首次开始前显著提示：填写内容及估算结果默认上传，保存一年，非必填项目可以跳过。涉及婚恋经历、财务、健康等敏感问项时仍明确标注。默认上传不等于静默收集，也不声称不登录即绝对不可识别。经营者应在公开发布前确认收集目的、联系渠道及适用隐私要求；本设计不是法律合规意见。

用户可以清除本机数据，并凭本机保留的随机管理凭据删除本次云端记录。这不是账号系统或后台。丢失凭据不建立身份找回流程。

## 6. 排除项

不做真实人物匹配、公开画像、登录、聊天、排行榜、收费、支付、管理员页面、AI颜值、上传照片、LLM调用、软偏好、软硬双人数、实时人口/汇率、自动星座合盘、自动推断生肖、面向全国网络的首发优化、重型测试平台、自动学习用户上传数据、云端保存分享图片。

## 7. 实现默认值的地位

字段控件、粗粒度区域、初版系数、颜色、分组、API形式、自动保存间隔是本次设计默认值。它们可以在不改变上述需求的前提下修订，并记入决策日志；不因此重新要求用户回答已经解决的问题。数值正确性研究放在完整功能之后。
````````
<!-- END FILE: docs/01-product.md -->

<!-- BEGIN FILE: docs/02-ux.md -->
````````markdown
# 02｜页面、交互与视觉设计

## 1. 页面信息架构

采用单页应用和 hash 路由：`/#/`、`/#/form`、`/#/result`、`/#/privacy`。URL不包含答案、记录管理token或结果明细。不提供公开结果短链接。

首页只包含工作名、一句产品说明、80亿演示起点、参数为演示模型的标识、默认保存一年说明和“开始估算”。已有本机草稿时提供“继续上次”“新建一次”；新建不等于删除上一条云记录，保留本机管理条目以供后续删除。

填写页为分组长页面，不是每题必须点下一步的问卷。九组字段全部实现；前四组默认展开，职业、生活、家庭、长期相处、类型组可折叠，但标题、展开入口和填写数始终可见，不能借折叠删减范围。

## 2. PC 布局

宽度达到1024px使用主区域＋右侧固定摘要；页面最大宽度1280px。主区每张条件卡片为“我的情况 | 对方要求”两列。右侧约280px展示当前人数、已启用要求数、两侧分数与覆盖项数、保存状态、查看结果按钮。

```text
东京·爱情故事                              计算方式  数据说明
基础 / 经历 / 外貌 / 教育 / 财务 / ...        当前符合要求
┌ 年龄 ────────────────────────────┐      约 128 万人
│ 我的情况          对方要求          │      已启用 6 项
│ [ 32岁 ]          [无要求][25～35]  │      自身分 / 要求分
│                   预计覆盖 ███ 20% │      已保存 / 正在保存
└──────────────────────────────────┘      [查看结果]
```

此处数字是布局示例，不是模型样例或统计事实。

## 3. 手机布局

360～767px单列；768～1023px仍优先单列，避免狭窄双列。顶部 sticky 人数条包含“预计候选人数”和模型标识，保持约64～84px；安全区使用 `env(safe-area-inset-top)`。卡片中先自身、后要求。底部可放“查看结果”，留底部安全区和内容padding，不遮挡最后字段与键盘。

输入框至少16px字；触控区域设计目标44×44 CSS px；按钮可换行，禁止横向页面溢出。原生数值键盘只用于自身数值；对象数值范围使用预设及两个可选端点，不强制拖动滑块。下拉仅用于长列表端点，常见条件用按钮。

## 4. 视觉系统

用“清爽数据工具”而不是婚介广告页：米白背景 `#F7F5F0`，白色卡片，深墨正文 `#24343B`，主操作青绿 `#177E79`，稀缺强调陶橙 `#C86642`，分隔线 `#E4E2DC`。字体为系统中文/日文字体栈，不从第三方字体CDN加载。卡片圆角12px，间距8px倍数，阴影极轻。

大数字是第一视觉层级；评分是次级；说明收纳进可展开“怎么算的”。结果低不弹羞辱性红色警报，不播放嘲讽声音，不使用“你不配”“不可能”等文案。

颜色是设计建议，需在实现时实际检查对比度。尊重 `prefers-reduced-motion`；数字动画仅用于视觉插值，不参与计算，不每一帧触发读屏播报。

## 5. 稀缺提示

所有按钮保留同等可点区域。按钮旁/下方显示比例条，条长直接对应0～100%的线性比例，极小时保留数字而不人为放大比例。显示：`演示模型覆盖率 1%`，不写“真实人群只有1%”。

类别分布图的互斥类别总和为100%；“至少某档”是累计覆盖率，不得与类别原始占比混为一图。例如985与211非985底层互斥；“211及以上”对应二者相加。

普通（≥20%）、较少（5%～20%）、稀少（1%～5%）、极少（<1%）是可改的展示阈值，不影响计算。不仅靠颜色，同时提供文字/比例。

当只有独立系数模型时，比例明确指本项演示比例；不要伪装成“结合你之前条件的实测比例”。以后联合模型再改变口径并升级版本。

## 6. 人数与评分展示

- 开场：候选 `8,000,000,000`，小字“演示起点”。开始后展示不可关闭的“成年人范围”基础步骤。
- >=1人：约数，人／万／亿；合理保留2～3位有效数字，而不是十几位精确整数。
- 0<N<1：主数字“预计不足1人”，详情给小数/科学计数法和“模型期望规模，不代表现实不存在”。
- 确定的零概率或相互矛盾的同字段范围：先提示输入问题；有效模型零结果标注“本模型下为0”。
- 尚有未解决的相对条件：显示“阶段性结果，有X项待补充”。
- 评分为0～100，保留1位；两侧分别注明“按已填写且可评分的X项计算”。无可评分项是空状态，不是0。
- 不显示一个“你配不配”的总判定，不自动建议用户按双方分差调整条件。

## 7. 放宽对比

结果页默认显示最多3个影响最大的单项方案，展开可查看其余。方案只动一个字段：降低一个最低门槛、提高一个上限、扩大范围、增加可接受类别或改为无要求。金额/年龄选项必须构成原要求的超集。

每行展示：原要求 → 新要求、原人数 → 新人数、增加规模。极小值通过科学计数/对数变化计算，避免除零或显示Infinity。先预览，点击“应用”才修改原答案并触发正常保存；预览本身不保存、不新建记录。不把三条增加人数相加。

## 8. 导出卡片

`ShareCard` 使用独立DOM，不直接截图整页、sticky栏或滚动窗口。默认逻辑宽540px，导出目标宽1080px；内容自适应高度，像素总量过大时自动降低pixelRatio，避免手机内存失败。

默认包含名称、人数、两侧模型分、要求摘要、选定的放宽对比、模型版本与“演示参数／非真实人口统计”。自身详细答案默认不显示。用户可以隐藏任一要求，隐藏只影响图片；图片要标明“部分条件已隐藏”，不可让读者以为显示项就是全部条件。模型免责声明不可隐藏。

用 `html-to-image` 转PNG，等待字体和布局稳定，条形图采用CSS或内联SVG；不依赖外部图片。提供下载/系统分享支持时的分享；移动端下载受浏览器限制时，回退为显示可长按保存的完整PNG。无需将图片上传云端。

## 9. 保存与异常

汇总状态仅在确认后显示“已保存”。分别显示本机已保存、待上传、上传中、云端已保存、上传失败、记录已到期、凭据失效。不能把本机写入成功伪称云端成功。

刷新恢复表单、要求、记录ID、管理token和待重试的版本；禁用存储/隐私模式写入失败时显式提示“仅本次页面有效”。重试按钮和再次联网可重试，不能无限高频请求。完成状态修改后回到草稿，重新确认结果后才再次标成完成。
````````
<!-- END FILE: docs/02-ux.md -->

<!-- BEGIN FILE: docs/03-fields.md -->
````````markdown
# 03｜字段与初版选项字典

版本：catalog-demo-1.0.0。共63个字段；12个字段启用初版评分。所有字段均同时支持自身填写和对象要求；其他字段仍完整参与筛选。

## 通用规则

`config/catalog.demo.v1.json` 是可读机器定义，`config/model.demo.v1.json` 是演示分布及分值。JSON中的ID必须稳定；标签可改但不能在未迁移时改变ID语义。界面选项均附“无要求”；自身均可跳过。

枚举类别：自身单选，对方选择可接受集合（OR）。数值：自身输入或预设，对方用预设、端点选择与允许的相对要求。年龄/身高/体重为离散整数；金额规范化为人民币整数元，保留原币种与原金额。爱好属于可重叠标签，以至少有一个选中爱好为匹配。

原Excel“父、母”细项对称展开；“习惯/生活习惯兼容度”共同使用作息字段，不重复生成同一个过滤器。“三观”“健康”等复合项目拆成明确问项，未新增政治或宗教偏好。AI颜值移除。

## 基础与地区

| ID / 字段 | 自身与对象选项 | 初版评分 | 原始对应 |
|---|---|---|---|
| `gender`<br>性别 | 女；男；其他 | 不计分，仍可筛选 | 性别 |
| `age`<br>年龄 | 自身 18～100 岁；对象预设：18～24岁；25～29岁；30～34岁；35～39岁；40～49岁；50岁及以上；相对条件：与我相差3岁以内；与我相差5岁以内 | 不计分，仍可筛选 | 年龄 |
| `nationality`<br>国籍 | 中国；日本；韩国；美国；加拿大；澳大利亚；其他 | 不计分，仍可筛选 | 国籍 |
| `residence`<br>现居地 | 中国大陆·上海；中国大陆·江苏；中国大陆·浙江；中国大陆·北京；中国大陆·广东；中国大陆·其他；日本·东京；日本·神奈川；日本·埼玉；日本·千叶；日本·大阪；日本·其他；其他地区 | 不计分，仍可筛选 | 现居地 |
| `hukou`<br>户籍 | 上海；江苏；浙江；北京；广东；中国大陆其他；不适用：中国大陆户籍之外 | 不计分，仍可筛选 | 户籍 |
| `marital_status`<br>婚姻状况 | 未婚；离异无子女；离异有子女；丧偶；已婚 | 不计分，仍可筛选 | 婚否 |

- **性别**：不参与评分；不依据自身性别自动推断对方性别或性取向。
- **年龄**：初版数值支持18～100；无要求为全部成年人。101岁以上按模型尾部合并到100岁端点处理，UI须注明数值上限，不伪称真实年龄上限。
- **国籍**：初版粗粒度登记国籍单选；其他不等于不适用。以后可扩充类别。不得参与高低评分。
- **现居地**：不收精确地址。宏观区域展开为互斥叶子集合，重复项去重后求和。
- **户籍**：本字段明确指中国大陆户籍；不适用是一种已回答值，不是未填写。
- **婚姻状况**：初始不限，不暗中筛除已婚；产品只估算，不提供撮合。

## 婚恋经历

| ID / 字段 | 自身与对象选项 | 初版评分 | 原始对应 |
|---|---|---|---|
| `relationship_count`<br>恋爱经历 | 0次；1次；2～3次；4次及以上 | 不计分，仍可筛选 | 恋爱史／恋爱经历 |
| `cohabitation`<br>同居经历 | 无；曾经有；目前有 | 不计分，仍可筛选 | 恋爱史／同居经历 |

## 外貌与身体

| ID / 字段 | 自身与对象选项 | 初版评分 | 原始对应 |
|---|---|---|---|
| `height_cm`<br>身高 | 自身 120～220 cm；对象预设：160cm及以上；170cm及以上；175cm及以上；180cm及以上；相对条件：不低于我的身高 | 不计分，仍可筛选 | 身高 |
| `weight_kg`<br>体重 | 自身 30～250 kg；对象预设：45～60kg；55～75kg；80kg及以下 | 不计分，仍可筛选 | 体重 |
| `appearance`<br>颜值自评／要求 | 1档；2档；3档；4档；5档 | 参与，同模型 | 颜值／自评 |

- **身高**：不计算BMI或医疗健康分。
- **体重**：不把体重机械解释为健康水平，不参与综合评分。
- **颜值自评／要求**：主观演示档位；不上传照片、不进行AI评分。要求支持“至少X档”，展开为可接受集合。

## 教育背景

| ID / 字段 | 自身与对象选项 | 初版评分 | 原始对应 |
|---|---|---|---|
| `university_tier`<br>院校背景 | 二本及以下；一本（非211／985）；211（非985）；985；海外院校（单列） | 参与，同模型 | 学校 |
| `education`<br>最高学历 | 高中及以下；专科；本科；硕士；博士 | 参与，同模型 | 学历 |

- **院校背景**：仅为用户熟悉的演示分类，不宣称现代录取批次的普遍适用性；海外单列且分值是可改占位值。211与985的底层类别互斥。

## 职业与个人财务

| ID / 字段 | 自身与对象选项 | 初版评分 | 原始对应 |
|---|---|---|---|
| `home`<br>个人名下婚房 | 无；有，尚有房贷；有，已无房贷 | 参与，同模型 | 个人名下婚房 |
| `car`<br>个人名下汽车 | 无；有，尚有车贷；有，已无车贷 | 参与，同模型 | 个人名下汽车 |
| `other_assets_cny`<br>其他大额资产 | 自身 0～100000000 CNY；对象预设：10万元人民币及以上；50万元人民币及以上；100万元人民币及以上 | 参与，同模型 | 个人名下其他大额资产 |
| `debt_cny`<br>个人名下贷款余额 | 自身 0～100000000 CNY；对象预设：无贷款；10万元人民币以内；50万元人民币以内 | 参与，同模型 | 个人名下贷款 |
| `occupation`<br>工作类别 | 在读；IT／工程技术；专业服务；教育／科研；公共部门；企业职员；服务／技工；自由职业／自营；暂未工作；退休；其他 | 不计分，仍可筛选 | 工作类别 |
| `annual_income_cny`<br>税前年收入 | 自身 0～100000000 CNY/year；对象预设：12万元人民币及以上；24万元人民币及以上；50万元人民币及以上；100万元人民币及以上；相对条件：不低于我的年收入 | 参与，同模型 | 薪资 |
| `job_stability`<br>职业稳定性自评 | 波动较大；一般；相对稳定 | 参与，同模型 | 职业稳定性与行业风险 |
| `career_plan`<br>职业规划自评 | 正在探索；有大致方向；有明确计划 | 参与，同模型 | 个人职业规划与抗风险能力 |
| `risk_buffer`<br>收入中断可支撑时长 | 不足3个月；3～6个月；6～12个月；12个月及以上 | 参与，同模型 | 个人职业规划与抗风险能力 |
| `financial_assets_cny`<br>存款与有价证券 | 自身 0～100000000 CNY；对象预设：10万元人民币及以上；50万元人民币及以上；100万元人民币及以上 | 参与，同模型 | 存款（含有价证券） |

- **个人名下婚房**：婚房按能否用于婚后居住且个人名下定义；不推断房屋价值。
- **其他大额资产**：排除已单列的婚房、汽车和存款／证券；保存原币种和统一计算金额。
- **个人名下贷款余额**：包含房贷车贷；与资产相关性先不校准，不能把占位分当作专业财务评估。
- **工作类别**：不收单位名称；职业类别本身不排序评分。
- **税前年收入**：人民币／日元可切换；统一税前年收入，不混月薪、税后收入。
- **收入中断可支撑时长**：自评生活缓冲时间；不由存款自动推断。
- **存款与有价证券**：采用当前估计值；不输入账户或持仓明细。

## 性格与生活方式

| ID / 字段 | 自身与对象选项 | 初版评分 | 原始对应 |
|---|---|---|---|
| `sociability`<br>性格：内外向倾向 | 偏内向；中间型；偏外向 | 不计分，仍可筛选 | 性格 |
| `routine`<br>作息习惯 | 偏早睡早起；作息较规律；偏晚睡晚起；不固定 | 不计分，仍可筛选 | 习惯／生活习惯兼容度 |
| `social_frequency`<br>社交频率 | 较少；适中；较多 | 不计分，仍可筛选 | 习惯 |
| `hobbies`<br>爱好 | 运动；阅读；游戏；旅行；音乐；烹饪；影视；户外 | 不计分，仍可筛选 | 爱好 |
| `smoking`<br>吸烟情况 | 不吸烟；偶尔；经常 | 不计分，仍可筛选 | 不良嗜好／烟瘾 |
| `drinking`<br>饮酒情况 | 不饮酒；偶尔；经常；自述有失控饮酒问题 | 不计分，仍可筛选 | 不良嗜好／酗酒 |
| `gambling`<br>赌博相关情况 | 无；过去有，目前无；目前有 | 不计分，仍可筛选 | 不良嗜好／赌 |
| `drug_use`<br>毒品使用经历 | 无；过去有，目前无；目前有 | 不计分，仍可筛选 | 不良嗜好／毒 |

- **爱好**：自己可多选；对方勾选多个表示至少有其中一个爱好，不要求全部具备。
- **饮酒情况**：不做临床诊断。
- **毒品使用经历**：只收类别，不收具体违法细节；不参与评分。

## 原生家庭

| ID / 字段 | 自身与对象选项 | 初版评分 | 原始对应 |
|---|---|---|---|
| `parents_pension_cny`<br>父母养老金合计（月） | 自身 0～100000 CNY/month；对象预设：2000元人民币及以上；5000元人民币及以上；1万元人民币及以上 | 不计分，仍可筛选 | 父母养老金 |
| `father_age`<br>父亲年龄段 | 50岁以下；50～59岁；60～69岁；70岁及以上；已故；不清楚／不适用 | 不计分，仍可筛选 | 父亲／年龄段 |
| `father_education`<br>父亲学历 | 高中及以下；专科；本科；硕士；博士；不清楚／不适用 | 不计分，仍可筛选 | 父亲／学历 |
| `father_occupation`<br>父亲工作类别 | 在读；IT／工程技术；专业服务；教育／科研；公共部门；企业职员；服务／技工；自由职业／自营；暂未工作；退休；其他；不清楚／不适用 | 不计分，仍可筛选 | 父亲／工作 |
| `father_marital`<br>父亲婚姻情况 | 已婚；离异；丧偶；其他／不适用 | 不计分，仍可筛选 | 父亲／离异与否 |
| `mother_age`<br>母亲年龄段 | 50岁以下；50～59岁；60～69岁；70岁及以上；已故；不清楚／不适用 | 不计分，仍可筛选 | 母亲／年龄段 |
| `mother_education`<br>母亲学历 | 高中及以下；专科；本科；硕士；博士；不清楚／不适用 | 不计分，仍可筛选 | 母亲／学历 |
| `mother_occupation`<br>母亲工作类别 | 在读；IT／工程技术；专业服务；教育／科研；公共部门；企业职员；服务／技工；自由职业／自营；暂未工作；退休；其他；不清楚／不适用 | 不计分，仍可筛选 | 母亲／工作 |
| `mother_marital`<br>母亲婚姻情况 | 已婚；离异；丧偶；其他／不适用 | 不计分，仍可筛选 | 母亲／离异与否 |
| `only_child`<br>是否独生子女 | 是；否 | 不计分，仍可筛选 | 是否独生子 |
| `family_net_assets_cny`<br>家庭净资产 | 自身 -100000000～100000000 CNY；对象预设：10万元人民币及以上；50万元人民币及以上；100万元人民币及以上 | 不计分，仍可筛选 | 家庭净资产 |
| `live_with_parents`<br>婚后与父母同住意向 | 倾向分开居住；倾向同住；可协商 | 不计分，仍可筛选 | 原生家庭的边界感与相处模式 |
| `parent_involvement`<br>父母参与重大决定的方式 | 夫妻自主决定；听取建议后自主决定；家庭共同决定 | 不计分，仍可筛选 | 原生家庭的边界感与相处模式 |
| `family_support`<br>对原生家庭经济支持安排 | 无固定支持；有固定支持；按需要协商 | 不计分，仍可筛选 | 原生家庭的边界感与相处模式 |

- **父母养老金合计（月）**：含公共养老金与稳定退休金；按合计月额，不适用可跳过。
- **家庭净资产**：原生家庭资产减债务的粗略合计，允许为负；不参与初版评分，避免与个人资产重复排名。

## 健康与长期相处

| ID / 字段 | 自身与对象选项 | 初版评分 | 原始对应 |
|---|---|---|---|
| `hereditary_history`<br>已知遗传病史情况 | 无已知情况；有已知情况；不清楚 | 不计分，仍可筛选 | 遗传病史 |
| `spending_style`<br>消费与储蓄取向 | 偏储蓄；平衡；偏当下体验 | 不计分，仍可筛选 | 三观契合度 |
| `household_roles`<br>家务分工意向 | 尽量平均；按时间能力分工；其他协商安排 | 不计分，仍可筛选 | 三观契合度 |
| `work_family_priority`<br>工作与家庭安排 | 当前偏事业；两者兼顾；当前偏家庭 | 不计分，仍可筛选 | 三观契合度 |
| `emotion_regulation`<br>情绪调节自评 | 常需要较长时间平复；大多数时候能平复；通常能稳定表达 | 不计分，仍可筛选 | 情绪稳定性与冲突处理能力 |
| `conflict_style`<br>冲突处理倾向 | 倾向及时沟通；冷静后沟通；倾向回避；必要时寻求帮助 | 不计分，仍可筛选 | 情绪稳定性与冲突处理能力 |
| `credit_status`<br>信用与法律履约情况 | 无已知异常；曾有异常，已处理；有未处理事项；不清楚 | 不计分，仍可筛选 | 法律信用与债务透明度 |
| `debt_disclosure`<br>债务沟通意愿 | 愿意充分说明；确定婚姻计划前说明；倾向有限披露 | 不计分，仍可筛选 | 法律信用与债务透明度 |
| `children_plan`<br>生育意愿 | 希望有孩子；不希望有孩子；尚未决定 | 不计分，仍可筛选 | 生育观念与健康状况 |
| `children_number`<br>理想子女数量 | 0个；1个；2个；3个及以上；尚未决定 | 不计分，仍可筛选 | 生育观念与健康状况 |
| `parenting_arrangement`<br>育儿分工意向 | 共同承担；按工作情况协商；考虑家人协助；不适用／未决定 | 不计分，仍可筛选 | 生育观念与健康状况 |
| `health_status`<br>健康情况自述 | 目前无自述生活限制；有需持续管理的状况；有需日常协助的状况；不清楚 | 不计分，仍可筛选 | 生育观念与健康状况 |
| `cleanliness`<br>整洁习惯 | 较随意；定期整理；对整洁要求较高 | 不计分，仍可筛选 | 生活习惯兼容度 |
| `diet`<br>饮食习惯 | 食物选择较广；以素食为主；有特定饮食安排 | 不计分，仍可筛选 | 生活习惯兼容度 |
| `pets`<br>养宠物意向 | 愿意／已有；不愿意；可协商 | 不计分，仍可筛选 | 生活习惯兼容度 |

- **已知遗传病史情况**：自述类别；不收疾病名称、不推断遗传风险、不参与评分。
- **消费与储蓄取向**：不新增政治、宗教或意识形态评分。
- **情绪调节自评**：不是心理健康诊断。
- **信用与法律履约情况**：不查征信，不收案件细节，不做法律判断。
- **理想子女数量**：与生育意愿仅做输入一致性提示；初版允许该项单独不限，不额外做道德评价。
- **健康情况自述**：不进行诊断、寿命推断或医疗建议，不参与评分。
- **饮食习惯**：不推断宗教或疾病。

## 类型筛选

| ID / 字段 | 自身与对象选项 | 初版评分 | 原始对应 |
|---|---|---|---|
| `zodiac_sign`<br>星座 | 白羊；金牛；双子；巨蟹；狮子；处女；天秤；天蝎；射手；摩羯；水瓶；双鱼 | 不计分，仍可筛选 | 星象学 |
| `chinese_zodiac`<br>生肖 | 鼠；牛；虎；兔；龙；蛇；马；羊；猴；鸡；狗；猪 | 不计分，仍可筛选 | 生肖配 |
| `mbti`<br>MBTI | INTJ；INTP；INFJ；INFP；ISTJ；ISTP；ISFJ；ISFP；ENTJ；ENTP；ENFJ；ENFP；ESTJ；ESTP；ESFJ；ESFP；未测／不清楚 | 不计分，仍可筛选 | MBTI匹配 |

- **星座**：普通类型筛选，不宣称决定适配程度；不额外收生日。
- **生肖**：初版不与年龄推算、不开发合盘。
- **MBTI**：普通类别筛选，不做临床人格评估或类型优劣评分。

## 数值与金额控件补充

初版端点清单由配置生成：年龄每1岁；身高每1cm；体重每1kg；金额用常用门槛、0及最大开放端点。对象不需要键盘手输大数。日元显示用相同人民币门槛的演示换算等价值，币种切换不改变底层要求。自己的原始金额不可在切换显示时反复换算覆盖。

演示汇率1 JPY = 0.05 CNY只为开发一致性，不是当前市场汇率；页内标注并保存fx版本。房产、车、金融资产、其他资产的定义在对应卡片简注中明确。

敏感字段由JSON的`sensitive`标记驱动同样的提示和导出隐藏功能；不得将敏感标记用于额外人数惩罚。
````````
<!-- END FILE: docs/03-fields.md -->

<!-- BEGIN FILE: docs/04-model.md -->
````````markdown
# 04｜人数估算、统一评分与扩展接口

## 1. 第一版选择：独立系数演示模型

首版 `independent-fields-v1` 不做人口真实性研究，也不做复杂相关性拟合。公开标注“演示系数模型，非真实人口统计”。所有占位值均在 `config/model.demo.v1.json`，每个字段都已有非空分布，不允许Agent遗漏字段后统一返回1来冒充实现。

这些比例故意只服务功能开发。尤其学历/收入、年龄/婚否、国籍/居住地/户籍、家庭资产/个人资产并不一定独立；连乘的结果可能显著偏离现实。产品只能解释“在当前假设下的估计”，不能将一个演示零结果用于证明某类人现实中不存在，也不能以其替代科学证据。

基数 `B = 8,000,000,000`，演示成年比例 `a = 0.70`。开场只显示B；开始后进入 `N_adult = B*a = 5,600,000,000`。成年系数只应用一次。年龄字段的分布已以成年人为分母，不能再乘一次成年比例。

设有效、已启用要求集合为H，则：

```text
N = B × a × ∏ p_i(A_i), i ∈ H
```

`A_i`是该字段可接受的值集合；`any`不在H中，等价于系数1。自身资料不影响N，除非显式启用相对要求需要用它来确定A_i。

## 2. 各字段怎样得到系数

### 2.1 互斥类别

字段的基础类别各不重叠，概率之和为1。用户接受若干类别时，展开预设、集合去重后求和：

`p_i(A) = Σ mass[x], x∈unique(A)`。

例如“211及以上”展开为 `211_non985`、`985`；同时勾选“211及以上”和“985”仍只统计一次985。地区“中国大陆全域＋上海”也是同样处理。不得将两个多选按钮的总比例直接相乘或重复相加。

### 2.2 数值区间

`bucket_uniform_discrete` 的每个桶是 `[from,toExclusive)`，桶内每个离散取值等概率。字段有固定step。`gte v`对应 `x≥v`；`lte v`对应 `x≤v`；`between l,u`两个端点都包含。

计算每桶被允许离散值的数量 / 每桶全部离散值数量 × 桶质量，再求和。金额先以明确的演示汇率归一化为人民币整数元，遵循四舍五入；同一存档保留原金额和币种，切换显示不重复累计换算误差。

age数值域18～100，100为演示最高端点并合并更高尾部；身高/体重边界仅为初版输入支持范围，不代表世界上不存在范围外成年人。超范围输入提示，不静默截断自身资料。无要求永远是1而不是根据控件支持范围再次筛人。

### 2.3 可重叠标签

爱好不是互斥类别，不能把概率直接加起来。初版使用明确的“独立标签”占位假设：

`p(any_of A) = 1 - ∏(1 - prevalence[x])`。

自身可以多选；对方多选是至少有一个选中爱好，不是必须全部拥有。空选恢复any。当前不做all-of切换，避免增加初版复杂度。

### 2.4 相对要求

`relative`先依赖自身的同名值，转换成普通区间/门槛。比如自身32岁、相差3岁以内 → 29～35岁；相对年龄下界不低于18。缺失依赖或结果区间无效，产生可定位的issue，并让结果标记partial。不能用0作为缺失自身值。

## 3. 计算稳定性与解释

使用稳定的字段顺序重算；不依赖用户点击顺序，不在原人数上反复增量扣减。过程使用浮点全精度及对数累计：

`log10Expected = log10(B) + log10(a) + Σ log10(p_i)`。

p为0时使用明确的`zero`标志；正数下溢不能变成“真实为0”。保存可序列化的`expectedApprox`（无法表示时为null）、`log10Expected`和`isMathematicalZero`，不向JSON写Infinity/NaN。格式化只在显示层发生。

输出`trace`包含基础成年步骤及按规范顺序的各字段系数、前后人数。某次编辑的“本次变化”比较整个要求集合的前后结果；它与固定顺序的漏斗归因是两个展示含义，不混用。

基本不变量：全不限N=B*a；同组合不同点击顺序结果一致；放宽集合不减人数；取消最后一个要求回到成年人基数；同一字段不重复扣减。

## 4. 同一模型给两侧评分

字段评分函数记为 `g_i(x)∈[0,100]`，权重 `w_i`。类别通过配置映射，数值通过分段线性函数。自身回答使用该函数；对象要求投影成同一函数可处理的分值。

首版选择**可接受集合内的最低模型分**作为要求投影：

```text
self_i = g_i(自身值)
requirement_i = min { g_i(x) : x 满足此项要求 }
```

它表示要求对应的最低模型门槛，不是要求的统计稀缺程度。例如收入≥24万元和自身收入24万元使用同一g；硕士或博士的要求取二者最低分，即硕士分。单点条件与自身相同答案逐项分值完全一致。

区间最低分在端点及函数内部折点上求最小；不能对非单调函数只取下界。数值与类别的同一评分函数均复用，不另写一套“对方分”。无要求/跳过/不计分字段从各自分母中移除，不把它们计零。

```text
S(side) = Σ(w_i × side_i) / Σ(w_i)，只针对该侧已存在且可评分项
```

没有可评分项时score=null。覆盖率分别返回该侧有效计分项数、总可计分项数和使用的权重和；两侧覆盖项不同，禁止用分差推断“谁配得上谁”。放宽筛选后人数必不减少，但由于评分分母变化，综合分不承诺单调。

初版12个评分字段：颜值自评、院校背景、学历、婚房、汽车、其他大额资产、贷款余额、年收入、职业稳定性、职业规划、缓冲时长、存款与有价证券。全部权重默认1。性别、年龄、国籍、地域、健康、婚史、父母情况、MBTI等只筛选不排列价值高低。上述占位评分本身不是人生价值或专业财务评价。

案例：自身硕士80分＋年收入24万元70分 →75分；对方要求硕士及以上＋年收入≥24万元 →相同75分。加入任意不计分的国籍要求，不改变这两个分数，但可以改变候选人数。

## 5. 单项放宽

`RelaxationGenerator`对每个已启用有效字段生成1～若干个允许集合的真超集；数值用相邻预设端点，枚举可取消要求或扩充类别。全不限字段不生成建议。

每个方案都复制原snapshot，仅更改一个字段，再调用同一个PopulationEstimator；不拼乘其他方案的结果。按新旧log规模差或人数差排序，返回最多3个默认展示项和全部展开项。

预览只存在于临时UI状态；点击应用后才替换正式要求、改draft并自动保存。保存快照可以保留当前最优3条结果，但不得把预览历史当作额外测试记录。

## 6. 示例算例（全部为演示值）

使用女性0.495、东京现居0.002、25～34岁0.24、仅985 0.01、税前年收入≥24万元0.10：

`5,600,000,000 × 0.495 × 0.002 × 0.24 × 0.01 × 0.10 = 1,330.56`。

取消985这一项，其余不变，变为133,056。两个数字不是现实东京人口结论，仅用于前后端一致性测试。

## 7. 配置和版本

`catalogVersion`覆盖字段语义、选项ID、范围；`modelVersion`覆盖人数分布、评分与权重；`fxVersion`覆盖换算。任何修改必须创建新版本，不能改写既有版本的内容。前后端共享相同目录和纯函数包，服务端保存时复算，不信任客户端传来的人数与分数。

每份模型包含`status=synthetic-demo`、来源类型、来源说明；真实数据未来应记录出处、时间、人群口径、条件分母和局限。用户上传的便利样本不能直接当作全体人口分布，不做首版自动学习。

## 8. 未来接口，不提前实现算法

```typescript
interface PopulationEstimator {
  estimate(input: NormalizedInput, context: ModelContext): PopulationResult;
}
interface UnifiedScoreModel {
  scoreOwn(input: NormalizedInput, context: ModelContext): ScoreResult;
  scoreRequirements(input: NormalizedInput, context: ModelContext): ScoreResult;
}
interface AcceptanceEstimator {
  estimate(input: NormalizedInput, context: ModelContext):
    | { status: 'not_implemented' }
    | { status: 'estimated'; acceptanceModelVersion: string;
        mutualExpected: number | null; notes: string[] };
}
```

未来联合分布可以替换PopulationEstimator；一个相关字段组只能应用一个联合贡献，不能联合系数和原有单项系数一起重复乘。未来双向估算须明确“目标人群接受当前用户”的条件关系与数据来源，不等于自身分÷要求分。
````````
<!-- END FILE: docs/04-model.md -->

<!-- BEGIN FILE: docs/05-data-api.md -->
````````markdown
# 05｜记录、自动保存与匿名API

## 1. 存储决策

主存储选DynamoDB按需容量。浏览器即时计算；云端主要处理校验、复算和快照更新。S3只存站点静态文件，不存用户记录或图片。Parquet留作将来的运营侧分析格式，首版不做批量管线、扫描页面或分析后台。

不使用Lambda `/tmp`、内存、开发机本地文件作为生产记录的持久存储；这些不是跨实例可靠的记录库。[S2][S3]

## 2. 一条记录的含义

一条记录是一次测试，不是一位已验证用户。首次有效编辑建立记录；同一轮只维护一个最新完整快照，不把每个按键存成独立记录。新建测试生成新ID。不记录空白首页访问。

`draft`表示填写中或完成后又修改；`completed`表示用户已点击查看完整结果且输入有效。状态不是上传成功状态；保存失败的本机completed仍须标“待上传”。

## 3. 表设计

单表 `tls-{stage}-records`，分区键`recordId`，无排序键、GSI或全局副本。记录示意：

```json
{
  "recordId": "UUID-v4",
  "tokenHash": "SHA-256(random-management-token)",
  "revision": 7,
  "payloadHash": "SHA-256(canonical-payload)",
  "state": "completed",
  "schemaVersion": "1.0.0",
  "catalogVersion": "catalog-demo-1.0.0",
  "modelVersion": "model-demo-1.0.0",
  "fxVersion": "fx-demo-1.0.0",
  "createdAt": "2026-09-26T03:00:00.000Z",
  "updatedAt": "2026-09-26T03:10:00.000Z",
  "completedAt": "2026-09-26T03:10:00.000Z",
  "expiresAt": 1821927600,
  "noticeVersion": "privacy-1.0.0",
  "snapshot": {
    "own": {},
    "requirements": {},
    "currencyInputs": {},
    "result": {},
    "scores": {},
    "issues": [],
    "partial": false
  }
}
```

示例epoch应由日期函数生成并校验，不手写复制。服务端控制createdAt、updatedAt、completedAt、expiresAt、计算结果和tokenHash，拒绝客户端覆盖这些字段。`snapshot`只接受白名单schema；不允许任意扩展JSON、HTML或脚本。

HTTP原始body上限64KiB；设计目标单条DynamoDB记录不超过32KiB，实测后记录平均大小。应用不要贴近DynamoDB服务的极限才做校验。

## 4. 无账号的记录管理凭据

浏览器用 `crypto.randomUUID()` 生成recordId，用 `crypto.getRandomValues` 生成32字节随机管理token。两者在第一次请求前先写入本机，以便创建请求超时后使用相同ID/token重试。

token只经HTTPS的`Authorization: Bearer <token>`发送，服务端只存哈希并做常量时间比较。不能只凭recordId更新/删除；不能把token写入URL、日志、分享图、公开配置、Git或分析事件。它是本次记录的持有者凭据，不是身份验证账号。存在同源XSS/共享设备风险，所以不加载无关第三方脚本。

生产只有站点同源API；没有公开读取snapshot的GET或列表接口。恢复使用本机草稿，不从服务端拉取记录。

## 5. API契约

| 方法 / 路径 | 行为 |
|---|---|
| `GET /api/health` | 仅返回服务状态和可用模型版本，不返回个人数据；无需token。 |
| `POST /api/v1/records` | 新建完整草稿/完成快照；body含recordId、revision=1、版本及填写内容，token在header。 |
| `PUT /api/v1/records/{recordId}` | 替换该记录最新完整快照；必须合法token和正确revision；不存在时不得upsert。 |
| `DELETE /api/v1/records/{recordId}` | 删除快照内容；验证token，保留只含ID/token哈希/到期日的删除标记直至原到期日，防止迟到重试复活。 |

POST使用条件写`attribute_not_exists(recordId)`。若创建响应丢失，同ID同token的重试仅返回原创建元数据，不改createdAt/expiry；不同token不得覆盖。已删除/过期记录不可恢复。

PUT使用CAS：下一revision=当前+1。重试相同revision且payloadHash相同，视为幂等成功；同revision不同payload返回409。落后版本返回409和latestRevision，不能返回旧snapshot或token。条件写同时约束记录存在、tokenHash、当前revision、非deleted和expiresAt>now。

请求体只发送原始结构化答案/要求及版本，服务端用共享engine复算result/scores；不能把恶意客户端声称的“人数=0”“score=100”原样当成可信结果保存。

成功返回recordId、acceptedRevision、savedAt、expiresAt、服务器复算摘要。错误使用JSON：`INVALID_INPUT`(400)、`UNAUTHORIZED_RECORD`(403)、`NOT_FOUND`(404)、`REVISION_CONFLICT`(409)、`MODEL_VERSION_UNSUPPORTED`(409)、`RECORD_EXPIRED_OR_DELETED`(410)、`PAYLOAD_TOO_LARGE`(413)、`RATE_LIMITED`(429)、`TEMPORARY_UNAVAILABLE`(503)。不返回堆栈或请求原文。

## 6. 自动保存顺序

每次有效编辑立即保存本机状态。云端1.5秒防抖、普通更新最小间隔10秒、持续编辑最多30秒提交一次；完成、主动重试可立即flush。不存在有效编辑不建空记录。每条记录同一时刻只允许一个在途请求，后续变化合并为最新待发快照。

只有收到服务端确认才更新acceptedRevision并显示云端已保存。网络失败保留同一待发revision及payload，退避重试（例如2、5、15秒，达到次数后停止自动重试并显示按钮）；新的编辑不能无限增加重复请求。完成标志与内容合并成一次写入。

多标签页用storage事件/BroadcastChannel提示同一测试已有更新；409后保留两份本机候选内容，要求用户选择保留当前或继续另一标签的本机状态，不自动覆盖。无需建复杂协同编辑系统。

不依赖关闭页面时sendBeacon完成关键保存；关闭前未确认的更新由本机持久化并在下次打开后重试。

## 7. 一年到期的精确定义与限制

服务端UTC创建时间加一个公历年；2月29日到次年2月28日，同一UTC时刻。expiresAt用Unix秒。编辑不滚动续期，客户端不能延长。客户端所有本机副本也到期清理；先于首次上传的本机草稿用本机首次创建时间加一年作为本机上限。

DynamoDB TTL不是到秒物理删除：AWS说明到期记录通常数日内被清除。[S1] 因此本版明确是**一年到期立即业务失效，后台自动清理可能滞后**。到期记录拒绝更新/复活，运营导出也必须排除过期项。隐私说明不得承诺“精确到秒从所有介质彻底删除”。若后续需要物理删除SLA，单独增加到期清理任务，不把当前TTL伪装成硬删除承诺。

初版不启用用户数据PITR、跨区备份、导出归档或带payload的历史日志，避免不知情地留下超期副本。此选择接受没有误删恢复能力的代价。生产表用retain防误毁，不代表保留所有记录永久；表内TTL仍生效。

## 8. 删除、本机清除与重试

“删除本次云端记录”先停止其保存队列，确认凭据，等待已在途创建结束，再DELETE；成功后清空对应本机答案/token。云端删除使用墓碑以阻止迟到POST/PUT重新写入敏感内容。删除失败不伪称成功，也不丢弃唯一token；保留待删凭据供重试。

“仅清除本机”与“删除云端”文案明确区分。清除浏览器数据会丢失管理凭据，无法匿名找回，但原记录仍按原expiresAt到期。这是免登录方案的限制。

## 9. 日志与隐私边界

业务记录不保存IP、UA、设备指纹或真实身份。应用日志仅requestId、routeKey、状态码、耗时和固定错误类型；不记录Authorization、body、精确路径中的recordId或答案。API访问日志同样最小化，保留14天；CloudFront标准请求日志首版关闭。

网络/CDN/云服务仍会处理连接信息；不能声称技术上完全不会接触IP。前端源映射不公开敏感配置，公共资源内不得出现测试填写者的真实资料。数据静态加密使用AWS托管默认能力，不在前端放AWS密钥。

## 10. 未来分析

未来经单独授权的运营脚本可以按记录有效期导出经过字段裁剪的数据，转换Parquet；原生DynamoDB S3导出是DynamoDB JSON/Amazon Ion，不是直接Parquet。[S2] 导出是数据处理而非用户检索功能，但副本同样要遵守原expiresAt，不能借导出永久保存。首版不实现此管线。
````````
<!-- END FILE: docs/05-data-api.md -->

<!-- BEGIN FILE: docs/06-aws.md -->
````````markdown
# 06｜技术架构、AWS部署与费用控制

核对日期：2026-09-26。技术事实的官方来源索引见09；服务选型是本项目设计，不代表已经创建资源或完成部署。

## 1. 确定的技术栈

| 层 | 选择 | 原因 |
|---|---|---|
| 前端 | React + TypeScript + Vite，客户端SPA | 交互和计算以本机为主，无SSR需求；Vite可输出静态构建产物。[S10][S11] |
| 样式 | CSS Modules + CSS变量 | 原生Grid/Flex完成响应式，不引入大型设计系统。 |
| 状态 | React reducer/context + 小型持久化adapter | 避免为单表单引入复杂状态平台；页面和引擎分离。 |
| 校验 | Zod或等价的小型TS schema库 | 前后端共用输入白名单、范围及版本校验。初始化时选稳定版本并锁定。 |
| 人数、评分、放宽 | 独立纯TypeScript共享包 | 浏览器即时反馈，Lambda复用同一规则复算。 |
| 图表 | CSS条形图／内联SVG | 不额外加载完整图表框架。 |
| 导图 | html-to-image，独立ShareCard | 作者项目支持DOM到PNG，需处理大DOM/浏览器限制。[S12] |
| API | API Gateway HTTP API + Lambda | 仅少量快照管理路由，不上容器/常驻服务器。 |
| Lambda | Node.js 24，ARM64，256MB，timeout 5s | 24是官方支持运行时；不采用预览版。打包所用AWS SDK模块并锁版本。[S9] |
| 记录 | DynamoDB Standard，on-demand | 按记录更新、条件写、自动到期，不需要关系型检索。[S2] |
| 静态发布 | S3私有桶 + CloudFront OAC | 私有桶只允许指定distribution读取，不打开S3网站端点。[S4] |
| IaC | AWS CDK v2 + TypeScript | 所有资源以代码复现；本地synth与实际创建资源分开。[S13] |
| 测试 | 少量Vitest与1条浏览器端到端流程 + 日本手工冒烟 | 不增加重型测试平台、大陆专线优化、广泛设备矩阵。 |

React/Vite/依赖的补丁版本不凭本文件猜测：P0检查可用稳定版、兼容Node24并固定lockfile。后续不每次自动追latest。CDK版本须支持Node24运行时常量。

## 2. 拓扑

```text
PC / 手机浏览器
  ├─ 本机：字段渲染、人数/分数、放宽预览、草稿、PNG
  └─ HTTPS → CloudFront（同一站点域名）
                ├─ /*       → 私有S3静态站点桶（OAC）
                └─ /api/*   → 东京API Gateway HTTP API（不缓存）
                                      → Lambda（不放VPC）
                                           → DynamoDB记录表
                                           → CloudWatch最小日志
```

主区域`ap-northeast-1`。CloudFront为全球服务。首发只创建一个线上环境，开发在本机；不默认再复制整套staging资源。环境名参数可保留，不能意外改名造成数据表替换。

不创建EC2、VPC、NAT Gateway、ALB、RDS、Neptune、OpenSearch、ECS、Cognito、Bedrock或跨区数据库。当前服务之间无需为本项目另建NAT出网链路。

## 3. CloudFront与路径细节

默认站点先用CloudFront分配的HTTPS域名，不购买域名。前端API统一相对路径`/api`，开发时Vite代理到本机API。

| Behavior | Origin | 规则 |
|---|---|---|
| `/api/*` | HTTP API execute-api域名，$default stage | 所有必要HTTP方法；缓存禁用；不缓存成功/错误个人响应；返回Cache-Control: no-store。 |
| `/assets/*` | 私有S3 | 仅GET/HEAD；带内容哈希的产物长缓存。 |
| 默认 | 私有S3 | defaultRootObject=index.html；index.html最低TTL=0并按短缓存/重验证处理。 |

API源使用`AllViewerExceptHostHeader`或验证等价策略，转发Authorization但不要把站点Host原样传给API Gateway；官方特别说明API Gateway期待其源站Host。[S5] API路径原样保留，例如`/api/v1/records`就是HTTP API路由；不要再无意增加`/prod`或剥掉`/api`。

使用hash路由，因此不需要把所有403/404重写成index.html；禁止把API错误和缺失JS也重写成200 HTML。S3用标准桶源，不启用website endpoint，block public access全部打开，OAC只授权指定distribution。[S4]

生产同源，不以CORS作为鉴权。API Gateway默认源端点可能仍可直接访问，因此token校验和Gateway节流必须在源站本身也生效；不能声称CloudFront自动隐藏/保护所有写入源站。

## 4. 安全与限制

Lambda执行角色仅对指定表允许必要的GetItem/PutItem/UpdateItem等记录操作及自己的日志写入；无表Scan/Query、无S3记录读取、无全账户管理权限。运营导出不使用这一个执行角色。

HTTPS强制；生产API不允许任意跨站来源；默认不使用Cookie；安全响应头包含合理CSP、nosniff、Referrer-Policy与frame限制。导图需要的data/blob图片在CSP精确放行，不为方便添加任意脚本源。

首版节流默认：HTTP API stage 10 req/s、burst20；POST创建可更低（例如2 req/s、burst5）；Lambda reserved concurrency=5，不开provisioned concurrency。参数集中配置，真实用户429过多时再调。[S6]

这些是基础节流，不是按人识别、不保证阻止恶意批量提交、更不是硬费用封顶。第一版不引入验证码服务、WAF专用规则和设备指纹。公共传播/攻击上升后再评估WAF或挑战机制，同时防止绕过CloudFront源站。设置`UPLOAD_ENABLED`云端开关，必要时暂停写入而保留本机计算与导图。

## 5. 数据与运维默认值

DynamoDB TTL字段expiresAt，业务层检查到期；无GSI、PITR、自动导出或跨区备份。生产记录表启用删除保护并RemovalPolicy.RETAIN，禁止发布时替换/清空。此初版不提供数据误删恢复承诺。

CloudWatch日志14天，不含答案/token/IP字段。初版只配Lambda错误/API 5xx的基本告警及费用提醒，不接第三方付费可观测平台。CloudFront标准日志关闭，不设置包含URL token的任何日志格式。

S3只有构建产物。旧哈希资源保留一段回滚窗口（建议最近3个发布），上传新资产后再更新index.html，最后必要时仅失效index.html；不先删除旧资产导致旧页面加载失败。`/api/*`本来不缓存，不靠CloudFront invalidation修复API数据。

## 6. 费用规划：先按工作量估算，不许承诺免费

CDN、API、函数和记录写入是主要变量。DynamoDB按需写入按1KiB粒度，写16KiB完整快照并不只算1个写入单位。[S2] 用下面场景交付计算器输入，而不是把它伪装为实际账单：

| 假设 | 数量 |
|---|---:|
| 每月测试次数 | 10,000 |
| 每次平均保存 | 12次 |
| 每份记录计费大小（假设） | 16KiB |
| 每月快照写入 | 120,000次 |
| 普通写请求单位（估算） | 1,920,000 WRU |
| 一年内稳定月新增且无提前删除 | 120,000条，约1.83GiB原始16KiB记录，不含额外开销 |
| Lambda假设256MiB、平均100ms | 3,000 GB-s，加120,000次调用 |
| 每次首载约0.5MiB | 约4.88GiB CDN出站，不含重复访问和额外资源 |

实际还包含鉴权/幂等读取、重试、记录元数据、日志、源站请求等；用实现后的payload和调用次数复核。价格依东京区域、账户优惠与流量地区而异，以AWS当前计价/计算器为准，不把其他项目共享免费额度当作本项目保证。[S2][S7][S8][S14]

首版费用预警建议US$5 / US$10 / US$20，是告警阈值，不是预计账单或消费上限。AWS Budgets数据与告警存在延迟，不能当成实时熔断。[S15]

CloudFront当前同时提供flat-rate与按量方案。此设计默认按量，以便明确配置两类源站和缓存行为；不自动购买套餐，不假设免费计划涵盖所需全部缓存规则。部署前比较当前计划可作为非阻塞费用优化，不改变核心架构。[S14]

## 7. 资源拆分与配置

CDK推荐DataStack（DynamoDB）与AppStack（S3、CloudFront、API、Lambda、日志），明确依赖，避免前端发布替换数据表。单仓也可以实现；不得为“分层漂亮”增加更多云服务。

配置项：`AWS_ACCOUNT_ID`、`AWS_PROFILE`、`AWS_REGION=ap-northeast-1`、`APP_STAGE`、可选`DOMAIN_NAME`、可选`ACM_CERTIFICATE_ARN`、`BUDGET_ALERT_EMAIL`、节流参数。所有真实账户/域名/邮箱由本地环境或部署配置提供；不编造，不写密钥进Git。`VITE_*`只能放可公开配置。

没有账户或域名时仍完成本地运行、CDK代码与离线synth。synth不得依赖远端lookup；离线占位账户只用于模板检查，绝不能用于deploy。

## 8. 实际部署顺序（需要用户另行授权）

1. 完成本地verify、依赖锁定、构建，记录commit或工件版本。
2. 校验AWS当前身份与目标东京区域，输出资源差异、费用假设、权限与会写入的资源列表。
3. 对未bootstrap的账户/区域，经授权运行CDK bootstrap；该命令会创建S3/IAM等资源，不是纯本地操作。[S13]
4. 执行只读的模板diff；使用`cdk diff --no-change-set`，不让默认change-set流程借用部署权限产生写操作。[S16]
5. 经明确授权部署DataStack、AppStack并上传静态工件；先后端支持当前/前一模型，再更新前端，避免旧草稿立刻无法保存。
6. 输出站点URL、资源名称、日志位置、费用提醒状态，实际在日本PC和一部手机完成冒烟。
7. 国内测试仅给独立测试者URL，记录其反馈；不阻止日本首发。

可选自定义域名：CloudFront使用的ACM证书位于us-east-1，即使API/数据在东京；没有域名不阻止上线。[S17] 不自动买域名或改已有DNS。

## 9. 回滚与应急

前端：恢复上个index及对应旧资产。API：恢复上个已验证Lambda构建，保留支持旧模型的注册表。模型：切回版本指针，不覆盖旧配置、不静默改写旧记录。数据表不通过删库重建回滚。

异常写入：手动关闭UPLOAD_ENABLED或经授权调整API节流，客户端显示上传暂停并本机保留。费用告警后先检查流量与日志，再决定限制；不承诺阈值触发就自动停费。任何删除远程资源、数据库清空或数据扫描都需单独授权。
````````
<!-- END FILE: docs/06-aws.md -->

<!-- BEGIN FILE: docs/07-plan.md -->
````````markdown
# 07｜Agent实施计划与交付关卡

本包是设计与启动材料，不是已经实现的网页应用。以下命令是Agent必须创建并验证的目标契约，不能在它们尚不存在时声称已运行通过。

## 1. 目标工程结构

```text
apps/web/                 React表单、sticky摘要、结果与ShareCard
apps/api/                 Lambda handler、本机HTTP适配器
packages/domain/          类型、输入校验、规范化
packages/engine/          人数、同标评分、单项放宽、模型注册
packages/model-config/    从本包config迁移/引用的不可变版本配置
infra/                    CDK DataStack/AppStack
scripts/                  verify、doctor、release包装器
config/                   本包原始演示配置及部署样例
examples/                 可复制到测试里的公式算例
AGENTS.md / CONTEXT.md / harness.json
docs/                     按任务读取的规格
```

使用一个pnpm workspace，不引入微服务、容器编排、Nx/Turborepo等额外平台。本机API只监听127.0.0.1，文件型开发repository可放`.local-data/`并忽略Git；生产必须切换DynamoDB，不能将本机文件adapter部署为生产存储。

## 2. 阶段

| 阶段 | 任务 | 完成标准 |
|---|---|---|
| P0 工作区与骨架 | 读取已有规则、检查仓库、不覆盖用户文件；建立workspace、命令、锁文件、域类型、基础页面 | 本地能启动；CONTEXT记录真实状态；无云资源写入。 |
| P1 配置与纯引擎 | 接入全部63字段定义和演示模型；输入规范化、独立估算、统一评分、relative、版本；未来Acceptance接口返回not_implemented | 所有字段都有确定系数实现；附带算例与核心不变量通过。 |
| P2 响应式完整填写 | 可先用性别/年龄/地区/学历/收入跑通纵向流程，随后同阶段补齐63项；常驻人数、两侧评分、稀缺提示、回改 | 全字段可用、不是只有示例6项；手机与PC无横向溢出；不提前做系数真实性研究。 |
| P3 结果与导图 | 单项放宽预览/应用、条件摘要、ShareCard、隐藏字段、PNG保存回退 | 导图不截断；预览不污染记录；无账号也能本机完成。 |
| P4 快照与API | 本机恢复、保存队列、匿名管理token、幂等/CAS、草稿完成、到期、删除、Lambda DynamoDB adapter | 写入状态真实；不能越权覆盖；一年不续期；生产逻辑不信任客户端计算结果。 |
| P5 IaC与发布准备 | CDK、私有桶OAC、同源API无缓存、TTL/日志/节流、部署/回滚文档 | 本地verify/build/synth通过；资源变更清单完备；停在授权前，不自动deploy。 |
| P6 授权上线 | 用户提供/确认账户、明确授权创建资源后执行部署；日本PC和手机冒烟 | 交付真实URL和运行证据；没有部署权限就明确P6未执行，不阻塞前五阶段。 |
| P7 后续模型改进 | 调研来源、分群/联合分布、参数校准；以后做双向估算 | 独立迭代；不能反过来推迟可用首版。 |

Agent应连续推进可执行阶段，而不是完成P0就停下询问是否继续。遇到缺失账号、预算邮箱或域名，先完成P0～P5；不得因缺少这些信息停止本地开发。

## 3. 脚本契约

| 命令 | 内容 |
|---|---|
| `pnpm doctor` | 检查Node24、依赖、配置、工作区；显示缺失条件，不创建云资源。 |
| `pnpm dev` | 本机前端＋API＋本地存储adapter；不默默调用生产API。 |
| `pnpm lint` | 代码静态检查。 |
| `pnpm typecheck` | TS全仓类型检查。 |
| `pnpm test` | 少量纯函数/保存逻辑单测和附带算例，不做重型全组合测试。 |
| `pnpm test:smoke` | 一条核心浏览器流程，PC和手机视口复用；导图检查。 |
| `pnpm build` | 构建前端、共享包和API，不部署。 |
| `pnpm infra:synth` | 无远端lookup的CDK synth；只生成本地模板。 |
| `pnpm infra:diff` | 有有效AWS只读配置时运行`cdk diff --no-change-set`；明确缺少云身份的状态。 |
| `pnpm verify` | lint + typecheck + test + build；infra变更时再运行synth。 |
| `pnpm release:plan` | 输出目标账户/区域、diff、资源、成本假设、验证结果，不写云。 |
| `pnpm release:deploy` | 必须经本次明确授权和部署包装器检查；不得绕过审批。 |

脚本对Windows/WSL友好，跨平台逻辑用Node实现，不依赖全局Unix-only脚本。根packageManager字段与lockfile固定包管理器；无须在每次会话安装最新依赖。

## 4. 进度记录

每完成一段更新CONTEXT：已经实现、实际验证命令与结果、未做事项、下一步。设计完成不等于代码完成；mock存储通过不等于DynamoDB已验证；synth通过不等于上线通过。

任务日志围绕交付变化，避免把全部规格复制到每个报告。原bootstrap读一次完成初始化，后续以AGENTS+CONTEXT+相关文档执行。

## 5. 模型改进的后续路线

保留来源调查的独立任务：国籍/居住地/户籍、年龄、学历、收入资产先做；主观类谨慎标注无法可靠估计。真实数据必须写人群与年份，不拿中国收入分布直接代表全球、也不拿日本居民数直接代表中国籍在日人口。相关字段逐组替换，不重复扣减。本人分/对方分公式之后独立调整，不能让前端重写。

未来双向接受估算必须有单独版本、解释与不确定性设计。用户保存的偏好记录是非随机便利样本，不能自动当人口代表性证据。首版只预留接口，不伪造接受概率。
````````
<!-- END FILE: docs/07-plan.md -->

<!-- BEGIN FILE: docs/08-acceptance.md -->
````````markdown
# 08｜轻量验收清单

用户要求少做测试复杂度：以日本能用为准，大陆另测。这里是必要行为检查，不是重型测试方案；不要求覆盖率百分比、大规模设备矩阵、压力测试平台或多地区CI。

## 1. 引擎与关键数据逻辑

1. 开场80亿；开始后全不限为56亿演示成年人；成年系数不重复应用。
2. 任意字段组合最终结果不依赖点击顺序；放宽/取消不减人数；院校/地域重叠预设先去重。
3. 数值范围双端包含；自己缺失时relative变pending且阻止完成，不按0处理。
4. 同答案/同单项要求调用同一评分函数；无要求/跳过不按0；示例两侧75分一致。
5. 小正数显示不足1人，正数下溢不误变精确零；JSON无NaN/Infinity。
6. 单项放宽只改一项，预览不保存，应用才修改并保存。
7. 全部63字段有控件、默认分布和选择效果；不允许“复杂字段全部p=1”占位冒充完成。

## 2. 保存与隐私

8. 同一创建超时重试不产生重复记录、创建时间不变；重复PUT不重复推进revision。
9. 只知道recordId或使用错误token不能修改/删除；没有公开记录GET/list/scan端点。
10. 本机刷新可恢复；断网仍可试算/导图；失败不显示云端已保存；429有退避。
11. 一年expiry不随编辑延长；过期不再更新；删除后的迟到请求不复活snapshot。
12. 请求日志、图片、URL和构建产物不泄漏token/未选择导出的自身答案。服务端复算，不相信客户端分数。

## 3. 一条浏览器流程

在本机或已授权的日本线上站点：开始 → 自身部分跳过 → 选择年龄、国籍、现居地、院校、收入 → 修改一个早先要求 → 查看分数和人数 → 预览并应用单项放宽 → 导出PNG → 刷新恢复 → 检查保存状态。复用同一流程在PC视口和约390px手机视口运行。

上线手工用日本网络的一台PC浏览器和一部实际手机检查核心流程与图片保存。移动端至少实际检查一种Safari或Chrome浏览器；不由桌面模拟成功推断所有手机均已验证。没有设备时如实标“待人工确认”，不伪造通过记录。

## 4. 基础设施轻量检查

synth模板检查：没有VPC/NAT/EC2/RDS/Cognito/Bedrock；静态桶非公开且OAC；API不缓存并转发Authorization；记录表TTL、按需容量、生产防误删；Lambda最小权限；日志14天且无body；无自动部署Git hook。

部署后只测试synthetic记录；不要把真实婚恋、健康或资产信息放进测试工件。完成测试后删除测试记录。

## 5. 首版完成定义

P0～P5完成时：代码能本地运行、63字段齐全、引擎/结果/导图/保存协议/生产adapter/IaC完成；verify、核心smoke、synth有真实输出。P6另以真实部署与日本冒烟确认。当前交付的设计包只完成设计与配置校验，不满足“应用已实现/已上线”的定义。
````````
<!-- END FILE: docs/08-acceptance.md -->

<!-- BEGIN FILE: docs/09-sources-decisions.md -->
````````markdown
# 09｜来源、设计决策与变更规则

核对日期：2026-09-26。官方资料会更新，部署日再次核对运行时、价格和服务支持。以下资料用于技术设计；没有任何网页来源用于背书本包演示人口系数或评分。

## 1. 需求来源

用户提供《东京·爱情故事.xlsx》Sheet1，以及本对话逐轮确认。后确认的“无优先偏好、同一评分模型、默认上传一年、日本首发”等规则高于Excel早期草稿；不再恢复被删除的AI颜值。原表47行数据含空行、复合项和表头，不等于最终63个问项数。字段拆分见03。

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

## 3. 本次设计决策

| ADR | 决策 | 取舍 |
|---|---|---|
| 001 | 浏览器计算、服务端同引擎复算保存 | 少网络依赖；客户端参数公开，不能当反作弊秘密。 |
| 002 | 先用独立系数且明确演示 | 快速实现；不提供统计准确性或相关性保证。 |
| 003 | 同一g函数为两侧评分，要求取允许集合最低分 | 有清晰可实现语义；不是偏好概率，也不要求对分差做评价。 |
| 004 | DynamoDB保存最新快照，不用在线Parquet | 适合反复更新、条件写、到期；未来分析需另行转换。 |
| 005 | 记录持有者随机token，无登录与公开读取 | 保护修改权；失去本机凭据无法找回。 |
| 006 | 公历一年失效＋TTL后台清理，无PITR | 简单且减少副本；非精确物理删除SLA，无误删恢复。 |
| 007 | S3/CloudFront＋HTTP API/Lambda，东京单区域 | 不运维常驻主机；不保证大陆访问效果。 |
| 008 | hash路由、无SSR、无照片、无远程字体 | 降低部署与导图复杂度；首版不追求公开结果SEO。 |
| 009 | 短bootstrap＋按需文档；无默认push/deploy | Agent可自主完成本地工作，不自动消耗云费用或改远端。 |

## 4. 修改协议

业务需求改变先更新01；字段ID/语义改变更新catalogVersion；系数/分值改变创建新modelVersion；数据schema改变说明迁移；云资源改变附diff与费用影响。为修小bug不重复询问已确认需求，但不得用“合理优化”恢复排除项。

AGENTS、harness、权限策略的改变必须单独说明，不能与业务功能混合偷偷放宽。任何所谓guard配置都是软件约束，只有被实际工具/权限机制执行才算强制；一个JSON文件本身不是安全沙箱。
````````
<!-- END FILE: docs/09-sources-decisions.md -->

<!-- BEGIN FILE: examples/fixtures.demo.v1.json -->
````````json
{
  "schemaVersion": "1.0.0",
  "modelVersion": "model-demo-1.0.0",
  "kind": "synthetic-arithmetic-fixtures-not-population-facts",
  "cases": [
    {
      "id": "adult_only",
      "input": {
        "own": {},
        "requirements": {}
      },
      "expected": {
        "population": 5600000000,
        "ownScore": null,
        "requirementsScore": null
      }
    },
    {
      "id": "985_only",
      "input": {
        "own": {},
        "requirements": {
          "university_tier": {
            "state": "required",
            "predicate": {
              "op": "in",
              "values": [
                "985"
              ]
            }
          }
        }
      },
      "expected": {
        "population": 56000000,
        "ownScore": null,
        "requirementsScore": 90
      }
    },
    {
      "id": "211_including_985_union_dedup",
      "input": {
        "own": {},
        "requirements": {
          "university_tier": {
            "state": "required",
            "predicate": {
              "op": "in",
              "values": [
                "211_non985",
                "985",
                "985"
              ]
            }
          }
        }
      },
      "expected": {
        "population": 168000000,
        "ownScore": null,
        "requirementsScore": 75
      }
    },
    {
      "id": "tokyo_only",
      "input": {
        "own": {},
        "requirements": {
          "residence": {
            "state": "required",
            "predicate": {
              "op": "in",
              "values": [
                "jp_tokyo"
              ]
            }
          }
        }
      },
      "expected": {
        "population": 11200000,
        "ownScore": null,
        "requirementsScore": null
      }
    },
    {
      "id": "age_18_through_24_inclusive",
      "input": {
        "own": {},
        "requirements": {
          "age": {
            "state": "required",
            "predicate": {
              "op": "between",
              "min": 18,
              "max": 24
            }
          }
        }
      },
      "expected": {
        "population": 784000000,
        "ownScore": null,
        "requirementsScore": null
      }
    },
    {
      "id": "same_model_two_sides_75",
      "input": {
        "own": {
          "education": {
            "state": "answered",
            "value": "master"
          },
          "annual_income_cny": {
            "state": "answered",
            "value": 240000
          }
        },
        "requirements": {
          "education": {
            "state": "required",
            "predicate": {
              "op": "in",
              "values": [
                "master",
                "doctor"
              ]
            }
          },
          "annual_income_cny": {
            "state": "required",
            "predicate": {
              "op": "gte",
              "value": 240000
            }
          }
        }
      },
      "expected": {
        "population": 22400000,
        "ownScore": 75,
        "requirementsScore": 75
      }
    },
    {
      "id": "hobbies_any_of_no_double_sum",
      "input": {
        "own": {},
        "requirements": {
          "hobbies": {
            "state": "required",
            "predicate": {
              "op": "any_of",
              "values": [
                "sports",
                "reading"
              ]
            }
          }
        }
      },
      "expected": {
        "population": 3416000000,
        "ownScore": null,
        "requirementsScore": null
      }
    },
    {
      "id": "relative_age_32_plus_minus_3",
      "input": {
        "own": {
          "age": {
            "state": "answered",
            "value": 32
          }
        },
        "requirements": {
          "age": {
            "state": "required",
            "predicate": {
              "op": "relative",
              "sourceField": "age",
              "comparison": "between",
              "minOffset": -3,
              "maxOffset": 3
            }
          }
        }
      },
      "expected": {
        "population": 929600000,
        "ownScore": null,
        "requirementsScore": null
      }
    },
    {
      "id": "worked_example",
      "input": {
        "own": {},
        "requirements": {
          "gender": {
            "state": "required",
            "predicate": {
              "op": "in",
              "values": [
                "female"
              ]
            }
          },
          "residence": {
            "state": "required",
            "predicate": {
              "op": "in",
              "values": [
                "jp_tokyo"
              ]
            }
          },
          "age": {
            "state": "required",
            "predicate": {
              "op": "between",
              "min": 25,
              "max": 34
            }
          },
          "university_tier": {
            "state": "required",
            "predicate": {
              "op": "in",
              "values": [
                "985"
              ]
            }
          },
          "annual_income_cny": {
            "state": "required",
            "predicate": {
              "op": "gte",
              "value": 240000
            }
          }
        }
      },
      "expected": {
        "population": 1330.56,
        "ownScore": null,
        "requirementsScore": 80
      }
    },
    {
      "id": "relax_only_985_in_worked_example",
      "input": {
        "own": {},
        "requirements": {
          "gender": {
            "state": "required",
            "predicate": {
              "op": "in",
              "values": [
                "female"
              ]
            }
          },
          "residence": {
            "state": "required",
            "predicate": {
              "op": "in",
              "values": [
                "jp_tokyo"
              ]
            }
          },
          "age": {
            "state": "required",
            "predicate": {
              "op": "between",
              "min": 25,
              "max": 34
            }
          },
          "university_tier": {
            "state": "any"
          },
          "annual_income_cny": {
            "state": "required",
            "predicate": {
              "op": "gte",
              "value": 240000
            }
          }
        }
      },
      "expected": {
        "population": 133056,
        "ownScore": null,
        "requirementsScore": 70
      }
    }
  ]
}
````````
<!-- END FILE: examples/fixtures.demo.v1.json -->

<!-- BEGIN FILE: reference/excel-fields.md -->
````````markdown
# 原始Excel范围对照

来源：用户上传《东京·爱情故事.xlsx》，Sheet1。原文件保持不变，本包不包含对原Excel的修改版本。

基础：性别、年龄、户籍、婚否。经历：恋爱、同居。外貌：身高、体重、颜值自评、AI评。教育：学校、学历。类型：星象学、生肖配、MBTI。财务职业：婚房、汽车、其他大额资产、贷款、工作、薪资、职业稳定性/行业风险、职业规划/抗风险、存款含证券。生活：性格、习惯、爱好、吸烟、饮酒、赌博、毒品。家庭：遗传病史、父母养老金、父母年龄段/学历/工作/离异、独生子、家庭净资产、家庭边界。长期相处：三观、情绪与冲突、法律信用与债务、生育与健康、习惯兼容。

对话确认后的变化：删除AI颜值；加国籍和现居地；户籍明确与现居地分开；统一评分；无优先偏好；默认匿名上传一年；结果图片导出；面向日本可用，不把大陆测试作为发布门槛。

复合项拆分、重复生活习惯语义合并后共63问项，见catalog。前述原始条目不是实际数据分布；本包的所有系数都是独立拟定的演示参数。
````````
<!-- END FILE: reference/excel-fields.md -->

<!-- BEGIN FILE: scripts/validate_design.py -->
````````python
#!/usr/bin/env python3
"""Validate the design bundle and its synthetic arithmetic. No app/AWS tests."""
from __future__ import annotations
import json
import math
import re
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

def load(name: str):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))

catalog = load("config/catalog.demo.v1.json")
model = load("config/model.demo.v1.json")
fields = {f["id"]: f for f in catalog["fields"]}
assert len(fields) == len(catalog["fields"]) == 63
assert set(fields) == set(model["fields"])
assert model["status"] == "synthetic-demo"
assert model["notPopulationStatistics"] is True
assert model["catalogVersion"] == catalog["catalogVersion"]
assert 0 < model["adultFraction"] <= 1

for fid, f in fields.items():
    fm = model["fields"][fid]
    d = fm["distribution"]
    s = fm["score"]
    if f["kind"] in ("enum", "tags"):
        ids = [o["id"] for o in f["options"]]
        assert len(ids) == len(set(ids)), fid
        assert set(d["mass"]) == set(ids), fid
        assert all(0 <= p <= 1 for p in d["mass"].values()), fid
        if d["kind"] == "categorical":
            assert math.isclose(sum(d["mass"].values()), 1, abs_tol=1e-12), fid
        for preset in f["presets"]:
            assert set(preset["values"]) <= set(ids), fid
    else:
        buckets = d["buckets"]
        assert buckets[0]["from"] == f["minimum"], fid
        assert buckets[-1]["toExclusive"] == f["maximum"] + f["step"], fid
        assert math.isclose(sum(b["mass"] for b in buckets), 1, abs_tol=1e-12), fid
        for i, b in enumerate(buckets):
            assert b["from"] < b["toExclusive"] and 0 <= b["mass"] <= 1, fid
            if i:
                assert buckets[i-1]["toExclusive"] == b["from"], fid
        for preset in f["presets"]:
            assert preset["op"] in f["allowedOperators"], fid
    if s["kind"] == "excluded":
        assert not f["scoreEnabled"] and s["weight"] == 0, fid
    elif s["kind"] == "category_map":
        assert f["scoreEnabled"] and s["weight"] > 0, fid
        assert set(s["values"]) == {o["id"] for o in f["options"]}, fid
        assert all(0 <= v <= 100 for v in s["values"].values()), fid
    else:
        knots = s["knots"]
        assert f["scoreEnabled"] and s["weight"] > 0, fid
        assert knots[0]["value"] <= f["minimum"], fid
        assert knots[-1]["value"] >= f["maximum"], fid
        assert all(0 <= k["score"] <= 100 for k in knots), fid
        assert all(knots[i]["value"] < knots[i+1]["value"] for i in range(len(knots)-1)), fid


def resolve(fid: str, p: dict, own: dict):
    if p["op"] != "relative":
        return p
    a = own.get(p["sourceField"])
    if not a or a.get("state") != "answered" or not isinstance(a.get("value"), (int,float)):
        raise ValueError("missing_relative_source")
    v = a["value"]
    if p["comparison"] == "between":
        lo, hi = v+p["minOffset"], v+p["maxOffset"]
        if fid == "age":
            lo = max(18,lo)
        return {"op":"between", "min":lo, "max":hi}
    return {"op":p["comparison"], "value":v+p["offset"]}


def bounds(fid: str, p: dict):
    f = fields[fid]
    lo, hi = f["minimum"], f["maximum"]
    if p["op"] == "gte":
        lo = max(lo, p["value"])
    elif p["op"] == "lte":
        hi = min(hi, p["value"])
    elif p["op"] == "between":
        lo, hi = max(lo, p["min"]), min(hi, p["max"])
    else:
        raise ValueError(p)
    if lo > hi:
        raise ValueError("invalid_range")
    return lo, hi


def probability(fid: str, p: dict):
    f = fields[fid]
    d = model["fields"][fid]["distribution"]
    if d["kind"] == "categorical":
        return sum(d["mass"][v] for v in set(p["values"]))
    if d["kind"] == "independent_tags":
        return 1-math.prod(1-d["mass"][v] for v in set(p["values"]))
    lo, hi = bounds(fid,p)
    step=f["step"]
    total=0.0
    for b in d["buckets"]:
        n=round((b["toExclusive"]-b["from"])/step)
        first=max(0, math.ceil((lo-b["from"])/step))
        last=min(n-1, math.floor((hi-b["from"])/step))
        accepted=max(0, last-first+1)
        total += b["mass"]*accepted/n
    return total


def g(fid: str, value):
    s=model["fields"][fid]["score"]
    if s["kind"] == "category_map":
        return s["values"][value]
    ks=s["knots"]
    if value <= ks[0]["value"]:
        return ks[0]["score"]
    for a,b in zip(ks,ks[1:]):
        if value <= b["value"]:
            t=(value-a["value"])/(b["value"]-a["value"])
            return a["score"]+t*(b["score"]-a["score"])
    return ks[-1]["score"]


def project(fid: str, p: dict):
    s=model["fields"][fid]["score"]
    if s["kind"] == "category_map":
        return min(g(fid,v) for v in set(p["values"]))
    lo,hi=bounds(fid,p)
    xs=[lo,hi]+[k["value"] for k in s["knots"] if lo <= k["value"] <= hi]
    return min(g(fid,x) for x in xs)


def evaluate(inp: dict):
    own,req=inp["own"],inp["requirements"]
    n=model["basePopulation"]*model["adultFraction"]
    own_parts=[]; req_parts=[]
    for fid in fields:
        s=model["fields"][fid]["score"]
        r=req.get(fid,{"state":"any"})
        a=own.get(fid)
        if a and a["state"]=="answered" and s["weight"]:
            own_parts.append((g(fid,a["value"]),s["weight"]))
        if r["state"]=="required":
            p=resolve(fid,r["predicate"],own)
            n *= probability(fid,p)
            if s["weight"]:
                req_parts.append((project(fid,p),s["weight"]))
    def average(parts):
        return sum(v*w for v,w in parts)/sum(w for _,w in parts) if parts else None
    return {"population":n, "ownScore":average(own_parts), "requirementsScore":average(req_parts)}

fixture_report=[]
for case in load("examples/fixtures.demo.v1.json")["cases"]:
    result=evaluate(case["input"])
    for key,expected in case["expected"].items():
        if expected is None:
            assert result[key] is None, (case["id"],key,result[key])
        else:
            assert math.isclose(result[key],expected,rel_tol=1e-10,abs_tol=1e-8), (case["id"],key,result[key],expected)
    reverse_input={"own":case["input"]["own"],"requirements":dict(reversed(list(case["input"]["requirements"].items())))}
    assert math.isclose(evaluate(reverse_input)["population"],result["population"],rel_tol=1e-12)
    fixture_report.append({"id":case["id"],"result":result,"passed":True})

# Demonstrate exact same single values are scored equally and missing relative sources fail.
for fid,f in fields.items():
    if not f["scoreEnabled"]:
        continue
    if f["kind"]=="enum":
        v=f["options"][0]["id"]
        p={"op":"in","values":[v]}
    else:
        v=f["minimum"]
        p={"op":"between","min":v,"max":v}
    assert math.isclose(g(fid,v),project(fid,p),abs_tol=1e-12), fid
try:
    resolve("age",{"op":"relative","sourceField":"age","comparison":"between","minOffset":-3,"maxOffset":3},{})
    raise AssertionError("missing relative input silently accepted")
except ValueError as e:
    assert str(e)=="missing_relative_source"

# Ensure the reference contract has exactly the configured field IDs.
contract=(ROOT/"contracts/domain.ts").read_text(encoding="utf-8")
field_section=contract.split("export type FieldId =",1)[1].split(";",1)[0]
assert set(re.findall(r"'([^']+)'",field_section))==set(fields)

# Basic source reference and bundle completeness checks.
source_doc=(ROOT/"docs/09-sources-decisions.md").read_text(encoding="utf-8")
known_sources=set(re.findall(r"\[S(\d+)\]",source_doc))
for p in (ROOT/"docs").glob("*.md"):
    assert set(re.findall(r"\[S(\d+)\]",p.read_text(encoding="utf-8"))) <= known_sources, p
assert len(known_sources)==17
for path in ["bootstrap.md","AGENTS.md","CONTEXT.md","harness.json","README.md","docs/01-product.md","docs/09-sources-decisions.md"]:
    assert (ROOT/path).is_file(), path

report={
    "checkedAtUtc":datetime.now(timezone.utc).isoformat(),
    "scope":"design-bundle-and-synthetic-arithmetic-only",
    "fieldCount":len(fields),
    "scoreEnabledCount":sum(f["scoreEnabled"] for f in fields.values()),
    "fixtureCount":len(fixture_report),
    "configurationValid":True,
    "sourceReferenceCount":len(known_sources),
    "fixtures":fixture_report,
    "notPerformed":["web-app-implementation","lambda-implementation","cdk-synth","pnpm-tests","real-dynamodb-test","browser-test","aws-deployment"],
}
(ROOT/"validation-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:report[k] for k in ("scope","fieldCount","scoreEnabledCount","fixtureCount","configurationValid")},ensure_ascii=False))
````````
<!-- END FILE: scripts/validate_design.py -->

<!-- BEGIN FILE: validation-report.json -->
````````json
{
  "checkedAtUtc": "2026-09-26T12:33:34.080951+00:00",
  "scope": "design-bundle-and-synthetic-arithmetic-only",
  "fieldCount": 63,
  "scoreEnabledCount": 12,
  "fixtureCount": 10,
  "configurationValid": true,
  "sourceReferenceCount": 17,
  "fixtures": [
    {
      "id": "adult_only",
      "result": {
        "population": 5600000000.0,
        "ownScore": null,
        "requirementsScore": null
      },
      "passed": true
    },
    {
      "id": "985_only",
      "result": {
        "population": 56000000.0,
        "ownScore": null,
        "requirementsScore": 90.0
      },
      "passed": true
    },
    {
      "id": "211_including_985_union_dedup",
      "result": {
        "population": 168000000.0,
        "ownScore": null,
        "requirementsScore": 75.0
      },
      "passed": true
    },
    {
      "id": "tokyo_only",
      "result": {
        "population": 11200000.0,
        "ownScore": null,
        "requirementsScore": null
      },
      "passed": true
    },
    {
      "id": "age_18_through_24_inclusive",
      "result": {
        "population": 784000000.0000001,
        "ownScore": null,
        "requirementsScore": null
      },
      "passed": true
    },
    {
      "id": "same_model_two_sides_75",
      "result": {
        "population": 22400000.0,
        "ownScore": 75.0,
        "requirementsScore": 75.0
      },
      "passed": true
    },
    {
      "id": "hobbies_any_of_no_double_sum",
      "result": {
        "population": 3416000000.0,
        "ownScore": null,
        "requirementsScore": null
      },
      "passed": true
    },
    {
      "id": "relative_age_32_plus_minus_3",
      "result": {
        "population": 929599999.9999999,
        "ownScore": null,
        "requirementsScore": null
      },
      "passed": true
    },
    {
      "id": "worked_example",
      "result": {
        "population": 1330.5600000000002,
        "ownScore": null,
        "requirementsScore": 80.0
      },
      "passed": true
    },
    {
      "id": "relax_only_985_in_worked_example",
      "result": {
        "population": 133056.0,
        "ownScore": null,
        "requirementsScore": 70.0
      },
      "passed": true
    }
  ],
  "notPerformed": [
    "web-app-implementation",
    "lambda-implementation",
    "cdk-synth",
    "pnpm-tests",
    "real-dynamodb-test",
    "browser-test",
    "aws-deployment"
  ],
  "referenceContractTypecheck": {
    "command": "tsc --noEmit --strict --target ES2022 --module ESNext contracts/domain.ts",
    "passed": true,
    "scope": "reference-types-only-not-application"
  }
}
````````
<!-- END FILE: validation-report.json -->
