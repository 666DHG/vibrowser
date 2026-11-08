# Vibrowser 开发路线

v7 进度（2026-11-08）：已将完整规划简报改为内容重点投影，生成／评审／改进不再接收规划中的版面顺序及额外交互清单。21 项针对性回归及完整 109 项 Scala、42 项前端检查通过；固定六题真实对照已完成：最终成功 6/6、首轮 2/6，结构／排版改善 2/6，未达到默认开启门槛。设计实验继续默认关闭。以下保留此前版本记录。

更新：2026-11-08。按依赖、交付物和验收条件推进，不按天分配任务。

当前交付覆盖多标签与新窗口、网页与虚构搜索、多样布局、设置、DeepSeek 兼容接口、真实 PostgreSQL、保留旧页加载与共享书签。初始真实 Smoke 的 6/6 页面任务、缓存与重启恢复证据见 [LIVE_SMOKE.md](LIVE_SMOKE.md)；后续功能验收见下文。长期路线中的文件、完整站点设定与生图仍未实现。

## 本次交付与下一阶段

2026-11-07 制定的交互修复与标准／深入两挡已实现，原 18 样本真实对照及两例深入容量复测已完成。v3/v4/v5 的风格对照未达四组改善门槛；v6 动态视觉参照已接入，固定六题实验已完成（最终成功 6/6、视觉改善 3/6），尚未通过门槛。设计流程仍为 opt-in，完整目标未标记完成。详见 [计划与进度](DESIGN_NEXT.md) 和 [验收记录](DESIGN_ACCEPTANCE.md)。

WebDocument v3 已成为新生成默认格式：独立 HTML/CSS、隔离 iframe、封闭动作、站内搜索、局部替换/追加、会话交互状态与不可变书签版本。旧 PageSpec v1/v2 继续读取。课程职责、测试、真实调用的首轮失败和修复记录见 [v3 实施与验收](WEB_DOCUMENTS.md)。仅书签长期缓存；未收藏刷新重新生成，前进/后退使用会话中的原版本。

双模式与独立设置页：地址栏按标签保存幻觉/认真模式；认真模式接入官方 Search / Fetch、来源快照、身份选择、来源面板和同站资料复用。设置为 `vibrowser://settings`，包含 API 配置与项目说明，独立检索凭据使用 DPAPI。实现边界、验收证据见 [双模式记录](DUAL_MODES.md)。本轮沿用 v3 动作与不可变书签，未增加站点全局记忆或外部页面运行权限。

生成可靠性专项已完成内联实体绑定、确定性协议兼容、具体错误反馈、完整响应诊断与四次请求预算。真实失败首轮输出可本地回放，后续扩样以这些证据为基线。见 [修复与验收](GENERATION_RELIABILITY.md)。

学术主页加载专项：修复页面地址规则误删实体 fragment、将不同论文变成重复实体的问题；原地址真实重试与同输入新生成均完成，历史八个输出保留接受/拒绝分项结果。见 [学术主页排查](ACADEMIC_FRAGMENTS.md)。

内容驱动设计已在 `feat/content-driven-design` 实验分支实现：共享设计 skill、设计简报、浏览器测量、一次评审与一次改进、持久化候选和回退；不预设网站模板。自动检查通过，真实对照发现无效筛选承诺，尚未升级为默认流程。详见 [实现与实验验收](DESIGN_WORKFLOW.md)。真实父子页实体与品牌延续已通过；下一阶段先修正并复测交互语义，达到六组对照门槛后再考虑默认启用。

下一步优先级：

1. 按错误类别扩充真实输出回放集，优先消除确定性的协议摩擦，再扩大不同主题的真实交互样本，评估模型是否生成了合适控件，以及控件语义是否符合页面用途。保留失败样本，不把有限重试后的成功率当作首轮成功率。
2. 为筛选、排序、规格与购物车增加更丰富的封闭动作组合；本轮状态为字符串键值，尚不支持任意业务脚本或真实支付。
3. 建立站点级 SiteProfile 与跨路径事实共享；当前仅继承点击路径的实体、风格和祖先摘要。
4. 后续独立设计外部资源、生图与虚构文件协议，不扩大当前 iframe 的网络或脚本权限。

以下旧阶段记录保留为历史。表单搜索与隔离 HTML/CSS 已由本轮实现，不再属于待开始项目。

地址语义专项修复：原始输入与规范缓存地址分离，模型获得 Unicode 域名/路径，并明确搜索结果任务与绝对链接要求。Scala 检查扩展为 57 项；真实语义核对 3/4 通过，JT8-3 专名识别仍待解决；保留已有缓存，详见 [中文域名排查](ADDRESS_INTENT.md)。

点击路径一致性与交互细节已完成：加载面板入退场与单一滚动区、链接目标预览、PageSpec v2 实体引用和持久化 navigation_context；旧缓存不重建。53 项 Scala、41 项前端单测、23 项浏览器回归及三页真实 DeepSeek 连续点击通过，见 [动效、预览与上下文验收](CONTINUITY.md)。实体标题、作者、时间与回复数沿点击路径继承，缺失补齐、冲突有限修复；站点级共享记忆仍未实现。

浏览器外壳后续增强已完成：多标签与新窗口、独立历史/草稿/滚动、后台加载与关闭取消、窗口级恢复；两行顶部统一 48px，已移除左侧栏。非首页导航保留原内容，右下角显示持久化阶段记录，成功后提交历史；书签保存至 PostgreSQL，跨窗口共享并在新标签打开原缓存。该阶段检查为 37 项 Scala 测试、29 项前端单测、19 项浏览器测试及真实缓存重启验收，见 [加载与书签验收](BOOKMARKS_PROGRESS.md)；多标签初始记录见 [BROWSER_TABS.md](BROWSER_TABS.md)。

本轮继续完成网站布局扩展：8 种布局、4 套字体、7 种主题、可变组件数量及 48 个/4 层预算；新增文章、商品、讨论、代码等内容类型，并修复长正文与侧栏连续排版。真实 DeepSeek 新增四个站点全部成功，分别生成 35/39/41/37 个组件，见 [布局验收](LAYOUTS.md)。下方长期方案中旧的 12 组件/3 层等预算由本轮契约替代，后续仍需站点级风格持久化与更丰富的交互。

| 阶段 | 首版实际实现 | 尚未完成 |
| --- | --- | --- |
| S0 工程 | React/TS/Tailwind、Scala/Cats Effect/http4s、独立 PG16、格式化、启动/停止/检查脚本 | 干净新机器安装复验 |
| S1 契约 | PageId/JobId、PageSpec v2/实体/点击上下文、PageBlock、PageDesign/BlockStyle、18 种 BlockType（含兼容 footer）、7 种 Theme、封闭状态/风格枚举、跨端 fixtures | SiteProfile、FileSpec、声明式复杂 Action |
| S2 消息与表 | 10 个公开消息、5 张表、统一 POST、短事务、唯一约束、幂等扩展任务 steps 字段 | SiteTable、AssetTable、迁移版本管理 |
| S3 浏览器 | 中文多标签与新窗口、独立历史/草稿/滚动、窗口级恢复、保留旧页加载、右下角阶段面板与动效、链接预览、书签、设置、响应式 Renderer | 虚构文件预览、拖动排序、书签分类 |
| S4 生成 | DeepSeek 真实全链路、兼容接口预设、DPAPI、单 worker、模型结构归一化、JSON 校验、带错误上下文的单次修复、点击路径事实继承 | TokenHub/自定义接口实测、更大样本稳定性 |
| S5 稳定性 | 缓存、并发去重、条件重试、迟到响应保护、重启中断恢复、Mock/真实 schema 隔离 | 多进程 lease/心跳、长队列调度 |
| S6 增强 | 地址栏生成虚构搜索结果；ASCII/文字插画 | 表单内搜索 Action、生图、显式外部打开 |
| S7 交付 | 运行说明、53 项 Scala 测试、41 项前端单测、23 项浏览器回归、真实 Smoke、四站布局及书签重启验收、截图、分阶段提交 | 新机器复验 |

下一步按以下依赖推进，不按天分工：

1. **真实接口验收（首轮已完成）。** 六步已通过，保存任务 ID、内容哈希、模型与耗时，不记录密钥。后续新增模型或改变契约时重跑，并扩大样本观察成功率；本轮 6/6 不作为无限输入保证。
2. **站点一致性。** 本轮已完成点击路径快照与结构化实体继承；下一阶段再引入 SiteId、SiteProfile、SiteTable/Initializer；明确哪些站点字段第一次生成后固定。由 NavigateMessage 与完成消息组合公开表方法，PromptBuilder 仅读取有预算的摘要。退出条件是同站三次探索在名称、主题和事实设定上保持一致，已有页面缓存不变化。
3. **虚构文件。** 增加 FileSpec/FileFormat、对应 Renderer 和受控生成协议；虚拟 file 地址不读取真实磁盘。先做 TXT/Markdown/JSON，复用任务与校验边界。退出条件是生成、预览、返回和重启保持一致，非法格式/超长输出明确失败。
4. **多标签与交互。** 标签隔离与窗口隔离已完成，后台标签继续加载，关闭标签取消前端轮询；迟到响应不能修改其他标签。后续可增加拖动排序、链接直接在新标签打开、封闭表单 Action 及独立消息，由后端从已存页面验证。
5. **图片与运行扩展。** 单独核验图片 API 权限后设计 Asset 状态和持久化；文字先可读。多人或多进程使用前才引入身份、租约和部署配置，不沿用本机 trust 数据库配置。

本次类的入口、业务表字段、消息与状态流见 [架构当前实现](ARCHITECTURE.md)，初始测试证据见 [Smoke 记录](SMOKE_PROGRESS.md)。以下长期清单中的未选项代表目标差距，不要求为首版补建空类。

## 1. 目标、依据与范围

产品目标：输入陌生网址 → AI 生成可交互网页 → 点击链接继续探索 → 打开相关虚构文件 → 返回旧内容 → 重启后仍然一致。

代码目标：从一个前端交互可以追踪到 API 调用类、后端 Message、领域对象、公开 Table 方法及数据库约束。每阶段同时满足“功能可演示”和“实现符合规范”，再进入下一阶段。

规范原文与适用方式见 [课程规范落实](COURSE_STANDARDS.md)，服务边界与资源生命周期见 [架构设计](ARCHITECTURE.md)。

| 依据 | 落实方向 |
| --- | --- |
| 课程讲义 | Scala 不可变值、声明式集合处理、纯函数核心、Monad/IO；React 核心数据驱动派生数据与视图 |
| 本地 rules.txt | services 分层、独立消息类与 plan(connection)、final case class、编解码器、Table 封装、前端页面就近组织、Tailwind |
| 本项目设计 | browser/generation/system 逻辑模块、PageSpec、虚拟地址、受控生成、持久化与后台任务 |
| 尚待核验 | 依赖版本、账户权限、部署环境；未取得独立期中评分表，不推定类数量与评分的关系 |

实现有意义的类与协作关系，不为展示继承或增加类数量创建转发 Service、空 DTO、万能 Context 和庞大基类。

| 优先级 | 能力 | 最低验收边界 |
| --- | --- | --- |
| P0 | 浏览器外壳 | 地址栏、基础标签页、独立历史、前进/后退/刷新、加载和失败状态 |
| P0 | 虚构网页 | 受控组件、完整 PageSpec、可用链接与主题变化 |
| P0 | 虚构文件 | Markdown/TXT/JSON 生成、预览、保存；不读真实磁盘 |
| P0 | 持久化与稳定性 | 页面/站点设定保存，缓存复用，任务去重、有限重试、重启恢复 |
| P0 | 课程代码质量 | 类与模块职责、强类型契约、IO 边界、资源管理、针对性测试 |
| P1 | 搜索、配图、真实网页入口 | 分别验收，不阻塞核心功能 |
| P2 | 后续扩展 | 自然语言编辑、版本历史、更多交互、隔离 HTML/CSS 模式 |

MVP 不做浏览器内核、真实网页代理、文件管理器、账号体系、知识图谱、通用 Agent、动态编译 React 和交易业务。P0 未通过时暂停新增 P1/P2。

## 2. 阶段依赖与交付总览

```mermaid
flowchart LR
    S0[S0 工程与规范基线] --> S1[S1 领域类与契约]
    S1 --> S2[S2 表与消息闭环]
    S2 --> S3[S3 浏览器与 Mock 渲染]
    S3 --> S4[S4 AI 与后台任务]
    S4 --> S5[S5 一致性与恢复]
    S5 --> S6[S6 可选增强]
    S5 --> S7[S7 交付检查]
    S6 --> S7
```

S1 固定契约后，前端样例渲染与后端表实现可分别推进，集成仍须通过 S2/S3 验收。S6 可以跳过，S7 不能跳过。编号代表依赖，不代表工期。

| 阶段 | 交付物 | 退出条件 |
| --- | --- | --- |
| S0 | 骨架、工具链、配置与规范映射 | 两端可编译，资源和配置边界明确 |
| S1 | 领域类、响应结构、Schema、fixtures | 同一组合法/非法样例在两端判断一致 |
| S2 | Table/Initializer、消息路由、Mock 持久化 | HTTP → Message → PostgreSQL → 响应闭环 |
| S3 | 前端 API 类、页面状态/hooks、Renderer | 无 AI 也能探索网页和文件 |
| S4 | provider、worker、生成/校验流程 | 陌生网址和文件可真实生成并保存 |
| S5 | 并发、重试、重启与故障处理 | 缓存一致，无重复有效任务、永久加载或资源泄漏 |
| S6 | 搜索/图片/外部打开，逐项选做 | 每项独立验收，不削弱 P0 |
| S7 | 运行说明、规范记录、测试和演示 | 干净环境可复现，类设计可解释 |

## 3. S0：工程与课程规范基线

- [ ] 建立 frontend、backend、contracts、docs；子目录按需创建，不预先堆空目录。
- [ ] 业务代码归 services；系统能力归 services/system；逻辑分服务、单进程部署。
- [ ] 固定 Scala 3、JDK、sbt、Node、包管理器与依赖版本；先验证最小编译，再扩展。保留锁文件，不照抄讲义的历史版本。
- [ ] 建立格式化、类型检查、测试、构建入口；README 记录实际可运行命令。
- [ ] 配置 PostgreSQL、本地数据目录、后端环境变量示例与启动校验；Key 不进前端或 Git。
- [ ] 使用 Tailwind；组件变体通过静态类映射，AI 只选择已定义样式。
- [ ] 确定 java.sql.Connection 的连接/事务管理，资源由 Cats Effect Resource 管理，区分请求与后台任务生命周期。

| 系统类型 | 形式 | 职责 |
| --- | --- | --- |
| APIMessage[Response] | trait | 唯一必要执行入口 plan(connection: Connection): IO[Response] |
| NoRequestMessage[Response] | trait | 真实无业务入参操作使用；不创建空 Request 包装 |
| RegisteredAPIMessage | final case class | 消息类型、编解码和构造注册信息 |
| APIMessageRouter | object | 查找注册、解码、执行和错误映射，不处理生成业务 |
| DatabaseSession | object | 获取/释放连接、短事务提交/回滚，不包含业务 SQL |
| AppConfig | final case class | 已校验配置数据；环境读取放系统工具中 |
| Main | IOApp 入口 object | 装配服务器、连接池和 worker 资源，作为应用执行边界 |

**验收：**路由注册可组合；配置错误清楚可见；格式/类型检查可运行；无未使用模板资源。

## 4. S1：领域类、状态与契约

### 4.1 领域对象清单

每个明确的领域对象独立文件，类型与伴生对象同文件；记录采用 final case class，有限状态采用 enum/封闭 ADT。字段不可变。

| 类型 | 内容 | 约束 |
| --- | --- | --- |
| PageId、SiteId、JobId、BlockId | 业务身份值 | 不能混用；伴生对象不随机生成 ID |
| VirtualAddress | web/file 地址的封闭变体 | 与真实磁盘路径、资源下载地址分离 |
| SiteProfile | 域名、名称、摘要、主题、实体 | 同域名复用，不包含数据库行为 |
| ThemeSpec | 颜色、字体、布局枚举 | 受控值、默认值与合法性规则 |
| PageSpec | schemaVersion、title、theme、blocks | 模型不决定 pageId、任务或持久化状态 |
| PageBlock | navbar/hero/text/image/card/grid/button/footer | 固定 discriminator，限制嵌套、总数、长度 |
| BrowserAction | navigate/toggle，后续 generate | 未知动作拒绝，分支覆盖完整 |
| FileSpec、FileFormat | 格式与内容 | 仅 md/txt/json；JSON 内容也须解析 |
| StoredContent | PageSpec 或 FileSpec | 用联合类型关联内容种类，不堆不相干的可空字段 |
| PageRecord | 身份、地址、站点、状态、内容、摘要、时间 | ready 必须有内容；generating 对应活动任务 |
| GenerationJob | 身份、pageId、状态、阶段、次数、错误、时间 | 终态明确；用户重试创建新 job |
| GenerationContext | 目标、来源、设定、摘要、限制 | 是生成请求数据，不是所有 API 的万能 Context |
| ValidationIssue | 字段路径、错误码、说明 | 可定位问题，也可用于修复提示 |

先实现 P0 类型；资产和搜索类型在对应能力开始时增加。标题等普通字符串无需逐个包装；身份、地址、有限状态要保留业务类型。

### 4.2 类实现要求

- [ ] 同名伴生对象提供 Circe Encoder/Decoder；数据结构按规则派生，非法值不能用强制转换或默认分支吞掉。
- [ ] 枚举伴生对象统一 toString/fromString 与编解码，不为相同表示增加 API/数据库两套转换。
- [ ] PageBlock/Action 的 wire 格式显式使用 type；用 fixtures 检查 Scala 编解码与 TS 判别联合一致，不假定 ADT 自动派生天然符合 Schema。
- [ ] 简单状态使用 enum；带数据的变体可在 enum 中引用各自独立的数据记录。若采用 sealed trait，直接子类型遵守 Scala 的同文件限制，不为单对象文件约定写出无法编译的类型层级。
- [ ] 值本身的合法性在构造/解码边界保证；跨字段、跨组件业务校验放所属服务 utils，由 Message 调用。
- [ ] 时钟、随机 ID、网络、数据库和流程不进入 objects；行映射留在 Table 内部。
- [ ] 领域对象与 API 响应有真实差异才拆 DTO；响应位于 objects/apiTypes。

### 4.3 契约交付

- [ ] contracts/schemas 保存版本化内容、Action、请求/响应 Schema。
- [ ] valid fixtures 覆盖主页、相对链接子页、toggle、三种文件；invalid fixtures 覆盖未知类型、重复 ID、失效目标、危险地址、过深嵌套、无效 JSON 文件。
- [ ] 初始上限：总组件含嵌套最多 12、最大深度 3、图片请求最多 3；补齐文本、用户输入和上下文预算。
- [ ] 未知 schemaVersion 拒绝并显示错误，不能让旧内容静默失效。

**验收：**对象编解码往返成功；有效样例可渲染；两端拒绝无效样例；副作用未藏进数据类。

## 5. S2：Table 与消息 API 闭环

### 5.1 模块归属

| 服务 | 维护内容 | 公开协作 |
| --- | --- | --- |
| browser | 地址、页面/文件、站点、导航、内容校验；sites/pages 表 | Message.plan、公开 Table def |
| generation | 任务、provider、worker、重试；generation_jobs 表 | Message.plan、公开 Table def |
| system | API 框架、配置、连接、启动、共享错误 | 明确的系统基础设施接口 |

允许 API 跨服务调用封装好的 Table def，无需为转发再套 API/Service；不能访问其他服务的私有 utils、SQL 和行映射。

### 5.2 Table 类/对象实现

每表一个文件夹，包含 XxxTable.scala 与 XxxTableInitializer.scala。Table 主体是 object；私有 xxxSql 在公开 xxx(...): IO[T] 前方相邻定义。

| 模块 | 计划方法 | 约束 / 验收 |
| --- | --- | --- |
| SiteTable（browser） | findByDomain、insertIfAbsent、saveProfile | domain 唯一；已有设定不被并发初始化覆盖 |
| PageTable（browser） | findById、findByAddress、insertPending、saveReady、markFailed | 地址唯一；kind/status 检查；条件更新 |
| GenerationJobTable（generation） | findActiveByPage、insertQueued、claimNext、markReady、markFailed、findInterrupted | 每页一个活动任务，原子领取，终态不被迟到结果覆盖 |

Table 封装参数绑定、执行、行映射；接口使用业务类型，不接任意 SQL、不返回 SQL 供调用方执行。复杂业务放 API 或所属 utils。Initializer 维护各表建表语句、索引、约束和初始化；系统仅编排顺序。后续如引入迁移工具，另记决策并保留维护归属。

### 5.3 API 消息类实现

统一形态：final case class XxxMessage(业务输入) extends APIMessage[Response]；plan(connection) 返回一个 IO[Response]。

| Message | 输入 → 响应 | plan 的主要步骤 | HTTP 注册 |
| --- | --- | --- | --- |
| NavigateMessage | url、referrerPageId → NavigationResponse | 规范化，命中缓存或原子创建 page/job | 是 |
| GetPageMessage | pageId → PageResponse | 查询状态和内容，不触发生成 | 是 |
| RetryPageMessage | pageId、failedJobId → NavigationResponse | 校验失败代次，创建/复用新尝试 | 是 |
| ValidateGeneratedContentMessage | 候选内容 → ValidationResponse | 调用 browser 私有校验，返回合法内容或问题 | 否 |
| ClaimGenerationJobMessage | 无业务参数 → ClaimJobResponse | 原子领取任务与有限上下文；使用 NoRequestMessage | 否 |
| CompleteGenerationJobMessage | jobId、候选内容 → CompletionResponse | 校验内容及当前任务，事务保存页面与终态 | 否 |
| FailGenerationJobMessage | jobId、结构化错误 → CompletionResponse | 条件更新失败状态，忽略过期任务结果 | 否 |

消息文件应展示主要业务步骤，不增加仅转发的 NavigationService。重复或过长细节提取为 private[服务名] 工具；跨服务的校验通过消息公开，不改成全局 utils。

### 5.4 路由契约

采用统一 POST /api/{apiName}，从消息名移除末尾 Message 再转小写：NavigateMessage → navigate，GetPageMessage → getpage。旧 REST 草案被此规则替代。

- [ ] BrowserRoutes 注册面向前端的消息；后台内部消息不注册 HTTP。
- [ ] 有请求体的消息提供构造参数的 Decoder，响应提供 Encoder；无请求消息通过注册器构造，不额外创建空请求 DTO。
- [ ] 顶层合并服务级注册列表，不手动重复每个业务端点。
- [ ] 成功响应以 status 联合类型区分 ready/generating；输入及基础设施错误统一映射 HTTP 与 ErrorResponse。
- [ ] 前后端共享规范名称清单或生成信息；生产构建后仍一致，不能依赖会被压缩改名的 JS constructor.name。
- [ ] 每个前端 API 文件对应一个已注册消息；请求和响应验证有共享 fixtures。

**验收：**Mock 导航入库、查询、重启读取成功；重复导航不产生重复页面；内部消息不可经 HTTP 调用。

## 6. S3：前端类、状态与确定性渲染

### 6.1 页面组织和职责

pages/BrowserPage/index.tsx 只展示 TabBar、NavigationBar、ContentViewport、GenerationStatus 等主要区域。页面组件/hooks/stores/objects/functions 就近组织，通用 UI 才放 components/ui。

| 文件 / 模块 | 职责 | 边界 |
| --- | --- | --- |
| apis/browser/NavigateMessage.ts 等类 | 明确输入字段与 send(): Promise<Response> | 不保管 Key，不修改 UI 状态 |
| apis/system | 发送、名称映射、错误解码 | 不混入 browser 业务 |
| BrowserTab | tabId、历史列表、索引、当前请求标识 | 纯数据，不发请求 |
| ContentViewState | idle/loading/generating/ready/error 联合状态 | 不用冲突布尔值拼装状态 |
| browserStore | tabs、activeTabId 等核心状态；私有 store | 不重复保存 canGoBack 等派生值 |
| useBrowserNavigation | 导航、轮询清理、响应更新、过期请求检查 | 不生成内容 |
| deriveNavigationState | 从历史和索引计算展示数据 | 纯函数，不调用 hook/getState/网络 |
| PageRenderer | 对 block 类型完整分支渲染 | 不执行任意 HTML/JS、不访问 LLM |
| FileViewer | Markdown/TXT/JSON 预览 | 不访问真实磁盘 |

API 调用器使用简单 class；React 使用函数组件与 hooks；纯计算用普通函数，不把所有前端逻辑都变成类。

### 6.2 实施任务

- [ ] Zustand store 私有，公开语义明确的 use/set/getSnap 接口；仅保存真正共享的核心数据。
- [ ] 渲染使用订阅 hook；命令处理可按需读取快照；纯函数依赖显式参数。
- [ ] 可前进/后退、当前标题等由核心状态推导，不重复存储。
- [ ] 地址栏编辑草稿与已提交地址分开，切 tab 正确同步。
- [ ] 前进/后退移动索引；新导航截断后续历史；刷新不追加历史、不重新生成。
- [ ] 每 tab 维护请求标识；切页/关闭时清理轮询，迟到响应不能覆盖新导航。
- [ ] navigate 调后端，toggle 只更新当前页面局部状态；搜索暂不开放。
- [ ] Markdown 禁用原始 HTML，TXT 纯文本，JSON 解析后展示。
- [ ] 主题采用 Tailwind 静态变体；运行时色值若需 CSS 变量，校验值并记录必要样式例外。

**验收：**无 AI 完成主页 → 子页 → 文件 → 返回；标签历史独立；至少三组样例展示主题差异；toggle 不调用网络。

## 7. S4：AI 与后台任务

### 7.1 实现类型与模块

| 类型 / 模块 | 形式与职责 |
| --- | --- |
| TextGenerationClient | generation 私有工具中的能力 trait，支持真实 provider 与测试替身 |
| DeepSeekCompatibleClient | 持有配置和 HTTP 客户端的实现类，返回 IO，不自行执行 IO |
| MockTextGenerationClient | 确定性样例和故障注入实现，只用于显式测试/演示 |
| GenerationWorker | 私有实现类，领取任务、准备上下文、生成、提交完成/失败消息 |
| GenerationModule | 服务根部生命周期装配入口，对系统暴露 Resource，不暴露私有工具与业务捷径 |
| Prompt/解析工具 | private[generation] def；纯文本组装和纯解析，I/O 保持可见 |

GenerationModule.scala 是服务根部装配文件，不新增无归属目录；只提供后台资源生命周期，不替代业务消息。

### 7.2 执行顺序

1. NavigateMessage 在短事务中创建/复用页面与任务，返回 generating。
2. worker 用独立短连接执行 ClaimGenerationJobMessage，取得上下文后释放连接。
3. 事务外组装 Prompt、调用模型并解析候选内容。
4. 通过 browser 校验消息取得结构/业务错误；失败最多修复一次。
5. 用新短事务执行 CompleteGenerationJobMessage，再核对内容与 job 身份，保存内容和终态。
6. 失败则写稳定错误；前端查询真实阶段，不使用虚构进度。

provider 请求不占用数据库事务。worker 不捕获请求连接，不在多个 fiber 间并发使用同一 JDBC 连接。依赖在装配时注入 worker/client，不塞进每个消息或万能 Context。

### 7.3 实施任务

- [ ] 核验一个文本 provider，地址、模型、超时、预算可配置；记录实测结果。
- [ ] 一次生成整页，不对每个组件分别请求模型。
- [ ] 主页/子页/文件 Prompt 包含来源、站点主题、已知实体和限制。
- [ ] 处理空白、截断、错误格式与异常结束原因；参数兼容性以实际 provider 为准。
- [ ] 检查组件类型、唯一 ID、Action、链接、toggle 目标、深度、文件格式和大小。
- [ ] 总请求最多两次，网络重试与格式修复共用预算；鉴权/额度错误不自动重试。
- [ ] worker 有界并发、截止时间、关闭清理；日志含 pageId/jobId/阶段，不含 Key。
- [ ] 同站首次生成协调 SiteProfile 初始化，其他任务等待已确定设定或稍后重试，避免创建冲突品牌。

**验收：**两个新站点及子页、三种文件可真实生成并保存；坏内容不进入 ready；API 不可用时明确失败，不以 Mock 冒充真实生成。

## 8. S5：一致性、事务与故障恢复

这属于 P0，不是可选优化。

| 风险 | 实现任务 | 验收证据 |
| --- | --- | --- |
| 并发导航同 URL | 页面唯一键、活动任务约束、冲突后读已有任务 | 两请求共享 pageId/jobId，一个有效生成任务 |
| 重复重试 | failedJobId 与事务条件检查，复用新任务 | 一次失败的重复点击只启动一个活动任务 |
| 保存半成功 | 页面、站点必要更新与 job 终态同事务提交 | 中途失败回滚，无 ready 无内容 |
| 迟到 worker | 更新匹配当前 job 与活动状态 | 旧结果不覆盖新结果 |
| 进程中断 | 单实例启动将遗留 running 标为 interrupted，queued 可继续 | 无永久 generating，用户可重试 |
| 错误传播 | 纯函数类型化错误；边界转换稳定错误码 | 用户看不到 SQL、Key、堆栈 |
| 资源泄漏 | JDBC 阻塞操作与 Resource 管理 | 成功/失败/取消都释放 statement、resultSet 和连接 |
| 上下文漂移 | 缓存优先、站点设定固定、摘要有预算 | 再访内容不变，子页身份延续 |
| 地址误合并 | 主机/端口/fragment 规则固定，保留 path/query 意义 | 表驱动地址测试通过 |
| 前端竞态 | 请求标识、轮询取消、每 tab 独立状态 | 快速切页不被旧响应覆盖 |

不承诺外部调用严格 exactly-once：模型返回后、保存前崩溃，重试可能再次计费。MVP 明确失败并由用户重试，数据库只接受当前任务结果；多实例 lease/心跳与自动恢复留后续。

**验收：**关键并发/故障测试通过；重启恢复内容；异常和取消不泄漏资源。

## 9. S6：可选增强

### 搜索

- 新增 SearchBlock、GenerateAction、SearchResponse，更新联合类型和 fixtures。
- browser 新增 SubmitSearchMessage(pageId, actionId, query, requestId)，注册并提供对应前端类。
- 后端从已存 PageSpec 查找 Action，不信任客户端自报 operation；限制输入长度。
- 幂等范围包含来源页面、Action 与 requestId；结果有独立页面身份，可再次访问。
- 验收：重复提交不重复生成；不同查询得到不同结果；后退回到来源页。

### 图片

- 先核验常规生图权限、任务协议与费用；全景图授权不能证明常规配图可用。
- generation 按需新增 ImageSpec、AssetRecord、AssetStatus、AssetTable/Initializer、GetAssetMessage。
- 独立图片状态，文字先 ready，最多三张/页；失败保留占位，不回滚文字。
- 下载限制 provider 域名、重定向、大小、类型；持久保存资源，不依赖临时 URL。
- 验收：生图不可用仍能浏览；重启后图片仍可见。

### 真实网页入口

- 用户显式选择外部打开，显示目标地址；Vibe 导航不自动探测真实网站。
- 不为嵌入失败开发代理；若试做 iframe，保留外部打开入口，不承诺检测所有跨域失败。

## 10. S7：课程检查与最终交付

### 每次功能提交的完成定义

- [ ] 领域对象、Message、Table 和前端对应文件归属清楚。
- [ ] 数据对象单文件、final case class、伴生编解码；API 响应放 apiTypes。
- [ ] 构造参数承载业务输入，plan 返回 IO；无多余 execute、Service 转发或 Context。
- [ ] 主要步骤与副作用在 API 中可见，跨服务只调用公开边界。
- [ ] SQL 私有且位于配套 def 前；Table 封装参数、执行、映射。
- [ ] 核心函数无 I/O/时钟/随机；无业务层 unsafeRun、Scala var 或命令式集合循环。
- [ ] React 核心与派生状态分开，纯函数不调用 hook，渲染不读取快照。
- [ ] 有限状态更新 match/switch，跨端 fixtures 通过。
- [ ] 格式、类型、针对性测试通过；实现状态与文档一致。

### 验证矩阵

| 层 | 验证内容 | 意义 |
| --- | --- | --- |
| 纯函数/领域 | 地址、非法枚举、样式上限、组件校验 | 验证业务规则，不机械重复字段赋值 |
| 契约 | 编解码往返、两端 fixtures、路由名称 | 防止跨语言协议漂移 |
| Message + DB | 缓存、回滚、并发创建、重试、过期结果 | 用真实 PostgreSQL 验证，不能只依赖内存替身 |
| provider/worker | 超时、空输出、限流、修复、取消 | 验证尝试次数与资源释放 |
| 前端 | 历史、toggle、失败、迟到响应、轮询清理 | 验证用户行为与时间线 |
| 全链路 | 网站 → 子页 → 文件 → 返回 → 重启 | 验证核心产品闭环 |
| 规范 | 类/文件归属、utils 可见性、SQL/IO 边界 | 人工审查配合静态扫描；扫描命中须判断上下文 |

不按文件数量堆测试；构建通过不能代替规范审查，静态扫描不能代替事务和资源测试。

### 交付清单

- [ ] README：实际环境要求、配置、初始化、启动、验证命令与限制。
- [ ] 架构与类协作图：一个前端 send 如何进入后端 plan 和 Table。
- [ ] 数据字典/契约说明：表归属、索引、状态转换和序列化。
- [ ] 规范落实记录：规则来源、检查结果、必要差异与原因。
- [ ] 演示样例：月球咖啡站、子页、虚构旅行笔记及其他视觉主题。
- [ ] 测试记录与失败演示：缓存、非法输出、并发、重启。
- [ ] 预存演示清楚标识，与现场生成可区分。

答辩应能解释：为什么 PageSpec 是数据类、Message 是可执行操作、Table 是单例模块、provider 用能力抽象；哪些函数纯粹、IO 在哪里组合和执行；数据库如何阻止重复任务；虚构文件为何不会读取电脑文件。

**当前下一步：真实 DeepSeek 六步已通过，优先补站点一致性，再实施虚构文件。继续保留真实响应回归样例与模型边界测试；长期清单不等同于本次承诺。**


## 2026-11-04 缓存策略调整

已完成中文域名可读显示、仅书签地址缓存、未收藏刷新重新生成、启动时清理未收藏页面及任务。当前会话历史与点击上下文临时保留。详见 [CACHE_POLICY.md](CACHE_POLICY.md)。

## 2026-11-08 设计与思考档位实验进展

标准/深入档位、动作纠错与正文保护修复已提交。固定 18 样本、两例深入容量复测、精简指导六主题对照、真实前后日导航和最终 Mock 回归已完成；服务已恢复正常 LIVE。按最新用户要求，轻微交互不足只记录，不逐项扩张 prompt 或新增整页拒绝门槛。设计指导仍只有三组明确改善，尚未通过四组视觉改善门槛，目标二仍未完成，继续保留实验开关且默认关闭。详见[验收记录](DESIGN_ACCEPTANCE.md)、[实施与证据](DESIGN_NEXT.md)及 acceptance/effort-comparison.json（complete=true 表示固定样本均有终态）。

### 2026-11-08 最新实验状态

两挡与交互修复已实现，设计流程仍为 opt-in。v4 内容规划/视觉设计分离的六题实验已完成，但只有两题明确结构改善，未达到默认启用门槛。正文 Summary 绑定覆盖问题已修复并通过一次真实恢复验证。后续不以不断添加交互细则或重复抽样推进风格目标；允许小瑕疵，关注主要任务与正文完整性。见 [最新验收](DESIGN_ACCEPTANCE.md)。

v5 后续记录：任务优先指导的六题实验仅三组明确结构改善，仍未默认启用；已补充评审测量中的横向滚动上下文，并纠正页内锚点回放误判。完整目标仍在进行中。

采样对照已完成：六题仅三题可展示，未采用 temperature=1.3。保留原生产默认；新增独立 Copy 反馈默认值及文本 figure/figcaption/cite 支持，均无 prompt 增量。离线原样本仍有其他协议错误，未改写原失败。当前完整检查 Scala 114 项、前端 42 项通过；多样性目标仍未完成。详见 DESIGN_ACCEPTANCE.md 与 acceptance/effort-sampling-v1-decision.json。
