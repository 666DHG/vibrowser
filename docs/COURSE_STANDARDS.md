# 课程规范落实

本页将课程讲义与当前本地工程规范映射到 Vibrowser。它是实现与代码审查依据，不是对课程评分标准的推测。Smoke 已实现的证据见下表；正文保留的 SiteProfile、FileFormat、Action 等为后续设计示例。

## 首版实现证据与明确取舍

2026-11-05 设计实验：DesignBrief、DesignIssue/Review、LayoutElement/Viewport/Report、DesignWorkflow/Event 独立数据类与伴生 codec；DesignStage/Status/Selection 为封闭枚举。SaveDesignWorkflowMessage 使用 plan(connection): IO，GenerationJobTable 私有 SQL 保存 JSONB，候选与当前任务代次绑定。模型调用及 Chromium 进程由 IO/Resource 在事务外管理。见 [设计流程](DESIGN_WORKFLOW.md)。

2026-11-05 双模式：BrowsingMode 与检索阶段采用封闭枚举；ResearchSource/ResearchCandidate/ResearchSnapshot/ResearchSettings 等独立数据类及伴生 codecs。检索消息维持 plan(connection): IO，ResearchSnapshotTable 与 ResearchSettingsTable 分别管理快照和 DPAPI 密文；工具与模型在事务外执行。前端独立设置视图、来源面板、对应 API 类及标签模式迁移均就近组织。详见 [双模式实现与验收](DUAL_MODES.md)。

2026-11-05 v3：WebDocument、WebAction、WebBinding、SiteStyle、PageActionSnapshot 独立 final case class 与伴生 codecs；WebActionKind/EntityField 为封闭 enum。SubmitPageActionMessage 与校验/归一化消息保持 plan(connection): IO；PageActionTable/Initializer 管理快照与幂等请求，BookmarkTable 在首次 INSERT 原子保存状态，重复收藏不覆盖。前端 API 类提供 send，iframe 运行时与 hooks 位于 BrowserPage 附近；未增加转发 Service。HTML/CSS 解析、事实合并与模型协议分别归 browser/generation 私有工具，模型调用仍在短事务之外。见 [v3 验收](WEB_DOCUMENTS.md)。

本轮 v2 新增 EntityKind、PageEntity、EntityPrice、ReplyRange、NavigationItem、NavigationContext、SiteAppearance、AncestorSummary，均按独立数据文件与编解码组织；纯上下文提取属于 browser.utils，事实合并属于 generation.utils，跨服务校验仍通过消息。PageTable/Initializer 维护 JSONB 快照，NavigateMessage 保持 plan(connection)，前端对应 API.send；没有转发 Service。UI presence hook、目标解析和实体绑定均就近放置，见 [验证与类职责](CONTINUITY.md)。

加载与书签增强新增 BookmarkId/Bookmark/响应、GenerationStep 等独立 final case class 和 GenerationPhase 枚举，消息继续使用 plan(connection)。BookmarkTable/Initializer 维护书签，GenerationJobTable 原子记录阶段历史；前端显示内容与待完成导航分别建模，详见 [实现与验收](BOOKMARKS_PROGRESS.md)。

| 关注点 | 已实现文件/类型 | 验证 |
| --- | --- | --- |
| 消息与 IO | services/*/api 中各 Message；APIMessage.plan(Connection) | 编译、真实 PostgreSQL 消息集成测试 |
| 数据类与封闭状态 | PageId、JobId、PageSpec、PageRecord、GenerationJob、ProviderSettings；BlockType/Theme/PageStatus/JobStatus | 独立文件与伴生编解码，共同 fixtures |
| 表与边界 | PageTable、GenerationJobTable、SettingsTable、CredentialsTable 及各自 Initializer | 私有 SQL、参数绑定、短事务；并发与回滚测试 |
| 副作用与资源 | DatabaseSession、SqlExecutor、GenerationWorker、DeepSeekCompatibleClient | IO/Resource、超时取消、两次预算、失败终态 |
| 前端对应类 | frontend/src/apis/browser、settings、system | send()、稳定消息名与 Zod 响应校验 |
| 页面组织 | BrowserPage/components、hooks、objects、stores | Tailwind、核心状态/派生显示分离、E2E |
| 凭据 | CredentialProtection、ProviderConnection | DPAPI 往返、接口脱敏、切换地址重填、清除 |

实现取舍：

- PageBlock 是 final case class，组件种类由 BlockType enum 封闭；不同类型的必需字段在语义校验中检查，没有为每种组件复制相同传输字段。
- 布局扩展新增独立 PageDesign/BlockStyle final case class 与伴生编解码器，以及 PageLayout/Typography/Density/Accent/BlockVariant/BlockPlacement 枚举。布局规则为页面附近的纯函数，容器和内容组件按职责拆分；没有新增只转发的 Service，消息、表和 IO 边界保持原结构。跨端 fixtures 与桌面/手机浏览器测试验证契约和实际渲染，见 [布局验收](LAYOUTS.md)。
- 多标签采用页面级 BrowserSession/BrowserTab 类型、Zustand 状态、导航 hook、会话序列化函数和 BrowserTabs/TabContent 区域组件。异步结果按 tabId 归属，关闭与新导航在 hook 中管理取消，组件只负责交互与显示；没有把浏览器会话塞入后端对象或新增空转发消息，见 [多标签验收](BROWSER_TABS.md)。
- ProviderConnection 是仅后端内存使用的 final class，刻意不提供通用 JSON 编解码，toString 脱敏；它承载解密后的凭据，不作为普通可序列化领域记录。
- SqlExecutor 的公开函数属于 system 技术能力；业务 SQL 与行映射仍私有，未把业务查询转移到通用工具。
- settings 为本次新增服务。每个模块按需要创建目录，没有为无公开接口的 generation 添加空路由。
- 本次不实现 SiteProfile、虚构文件与复杂 Action；不为长期方案补空类。运行模式、生成来源与进度 phase 为技术元数据，业务终态由封闭枚举表达。
- Scalafmt/Prettier 是可重复检查；类职责、SQL 私有性和调用边界仍需结合源码审查，不能从测试通过推定全部课程评分项完成。
- 真实接口联调新增 GeneratedPageDecoder，作为 generation 内部纯函数处理模型结构简写，不放宽浏览器传输契约；PageSpec 解码与语义校验后再持久化。真实响应回归 fixture、错误字段路径、修复上下文和数量上限均有测试。

## 1. 来源与适用原则

| 来源 | 已核对内容 | 使用方式 |
| --- | --- | --- |
| [rules.txt](D:/Vault/大二秋/无代码/rules.txt) | 1–60 条本地工程规范 | 作为当前项目的具体目录、API、类与前端组织约定 |
| [lec2](D:/Vault/大二秋/无代码/讲义/lec2.md) | 前后端分工、不可变与声明式风格 | 指导 Scala/TypeScript 的表达与分层 |
| [lec3](D:/Vault/大二秋/无代码/讲义/lec3.md) | case class、enum、trait、对象设计、纯函数与 Monad | 指导领域建模及副作用边界 |
| [lec4](D:/Vault/大二秋/无代码/讲义/lec4.md) | 逻辑微服务、序列化、表与主外键 | 指导模块职责和持久化 |
| [lec5](D:/Vault/大二秋/无代码/讲义/lec5.md) | React 时间线、MVC、Zustand、页面组织、Tailwind | 指导状态管理与 UI 实现 |
| [代码编写规范总览](D:/Vault/大二秋/无代码/笔记/01-代码编写规范总览.md) | 要求、建议及讲义内的并列情况 | 快速索引，具体原话以讲义为准 |
| [sample.zip](D:/Vault/大二秋/无代码/sample.zip) | 抽查 APIMessage、消息实例、Table 和 Router | 实现参考；有差异时不照搬旧模板 |

这些本地链接面向当前工作区；外部读者需取得相应课程资料。没有把示例工程或课程附件整体复制进仓库。

规则中“要求”和“建议”分开处理。讲义一般推荐 case class，当前 rules.txt 对数据结构进一步要求 final case class；本项目按更具体的本地规范实现。尚未读取独立的期中评分表，不声称这些清单已经覆盖全部评分项。

## 2. 规则到项目实现的映射

| 规则 | Vibrowser 中的落实 | 审查证据 |
| --- | --- | --- |
| rules 1–10：服务归属和公开边界 | services/browser、generation、system；API 可调用其他 Message.plan 或任意服务公开 Table def | import 与调用图；无跨服务 utils/SQL 访问 |
| rules 8、12：服务内部工具 | 工具 def 使用 private[browser] / private[generation] 等 | 可见性检查；重复/长逻辑提取有理由 |
| rules 13–15：纯粹数据对象 | 每对象单文件，final case class + 伴生编解码；objects 不访问 I/O | 领域类、编解码测试与源码审查 |
| rules 16–19：导入、枚举与状态 | import 位于顶部；转换放伴生对象；PageBlock/Action/状态封闭建模 | 新增分支触发编译或穷尽检查 |
| rules 20–27：可执行消息 | 输入为构造参数，APIMessage 仅有返回类型参数，plan(connection): IO[Response] | 打开消息文件可看到业务顺序与依赖 |
| rules 23：避免转发 Service | NavigateMessage 直接组合公开表方法与校验 | 不存在 Message → Service → Table 的空转发链 |
| rules 24–26：传输对象与无请求操作 | 响应放 objects/apiTypes；无输入领取任务使用 NoRequestMessage | 无空 Request 类，无多个松散返回值 |
| rules 28–30：信任边界 | MVP 没有账号，不预建用户服务；Action 仍从已存页面验证 | 客户端不能自报任意可执行操作；以后加认证时在路由完成可信身份转换 |
| rules 31–33：路由 | 统一推导名称、每服务 XXRoutes、顶层合并注册 | 前后端命名 fixtures；内部消息不注册 |
| rules 34–38：表模块 | 一表一目录，Table/Initializer 分开；私有 Sql 在公开 IO def 前 | 数据库初始化和并发集成测试 |
| rules 39–47、57：前端页面 | BrowserPage 骨架可读，区域与状态就近；真正共享 UI 才上移 | 页面入口、目录与依赖审查 |
| rules 48–53：前端 API | apis/browser 与后端对应；简单类 + send；通用发送机制独立 | 从前端可追踪到后端同名消息 |
| rules 54–56、58–60 | 去掉无用模板、Tailwind、清楚目录、简单 TS、docs 分离、显式页面状态 | 类型/构建检查与结构审查 |
| lec2 页 29、31 | 使用 val 与 map/filter/flatMap，不写业务可变变量和命令式集合循环 | Scala 源码检查 |
| lec3 页 13–15、24–25 | 纯函数计算规则，IO 组合副作用，应用入口执行 | 无业务层 unsafeRun，资源管理测试 |
| lec5 页 4–9 | 核心数据与派生数据分开，纯函数/订阅/快照分开 | 前端状态设计与交互测试 |

## 3. 如何选择 class、case class、object、trait

| 形式 | 项目实例 | 选择理由 |
| --- | --- | --- |
| final case class | PageSpec、SiteProfile、PageId、API 响应 | 不可变数据，结构清楚，可编解码与比较 |
| final case class + plan | NavigateMessage、GetPageMessage | 每个实例是一项带明确输入的业务计划，返回 IO |
| enum / 封闭 ADT | FileFormat、BrowserAction、PageBlock、JobStatus | 有限状态与穷尽分支；enum 可引用独立数据记录，sealed trait 的直接子类型需遵守同文件限制 |
| object | PageTable、PageTableInitializer、BrowserRoutes、类型伴生对象 | 无逐请求身份的模块；不在单例里保存活动连接或可变用户状态 |
| trait | APIMessage、TextGenerationClient | 描述真实能力与替换点，避免无意义的深继承 |
| final class | 受管理的 provider 客户端、GenerationWorker | 持有配置和资源依赖；实例生命周期由 Resource 装配 |
| TypeScript class | NavigateMessage 调用器 | 输入字段清楚，send 返回明确响应 |
| 函数组件 / hook / 纯函数 | PageRenderer、useBrowserNavigation、deriveNavigationState | 按 React 时间线和计算职责选择，不机械改为类 |

数据对象示意（完整实现需给 PageId、ThemeSpec 等定义编解码器）：

```scala
final case class SiteProfile(
  id: SiteId,
  domain: String,
  name: String,
  theme: ThemeSpec
)

object SiteProfile:
  given Encoder[SiteProfile] = deriveEncoder[SiteProfile]
  given Decoder[SiteProfile] = deriveDecoder[SiteProfile]
```

消息类示意（示例类型来自计划，当前不是可编译源码）：

```scala
final case class GetPageMessage(pageId: PageId)
    extends APIMessage[PageResponse]:
  override def plan(connection: Connection): IO[PageResponse] =
    PageTable.findById(connection, pageId).flatMap {
      case Some(page) => IO.pure(buildPageResponse(page))
      case None => IO.raiseError(PageNotFound(pageId))
    }
```

buildPageResponse 是 browser 的私有纯工具；数据库行到 PageRecord 的映射仍属于 PageTable。不要把这两种映射塞进 objects，也不要为这一跳添加 PageService。

## 4. 副作用、错误与资源

- URL/组件校验、Prompt 组装、历史状态推导保持纯粹。返回 Either/Option/明确结果类型，不以 null 或任意字符串表达所有情况。
- Message 与 Table 返回 IO；HTTP、JDBC、文件写入、时钟和 ID 生成进入效果边界。
- 底层库抛出的异常在 IO 边界转为稳定错误；纯校验错误通过明确类型表达。事务失败需要保持失败语义以触发回滚，不能用“成功返回错误字段”掩盖部分提交。
- Resource 管理连接、statement、resultSet、客户端与 worker；JDBC 阻塞操作在阻塞边界执行。
- HTTP 请求连接只服务该请求。后台任务另取连接，模型调用在数据库事务之外；同一 JDBC 连接不得在多个任务中并发使用。
- 业务类不调用 unsafeRun；Main/框架负责运行。IO 组合不能成为把所有 I/O 隐藏进一个巨大工具函数的理由。

## 5. 讲义与模板差异的处理

| 观察到的情况 | 本项目采用的办法 |
| --- | --- |
| lec2 禁止 for 循环，lec3 示例使用 for/yield | 不使用命令式集合循环；IO 组合可采用讲义示例的 for/yield 或 flatMap。此为项目对两类写法的区分，不声称老师给出了额外豁免 |
| lec3 写课程不用 try/catch/finally，旧 Table 示例大量使用 | 新业务代码用 IO 错误组合，资源用 Resource；不照抄手工 try/finally |
| 示例公开表能力仍写 private[books]，rules 允许全后端调用公开 Table def | 新 Table 对外业务 def 公开，SQL/行映射私有；utils 保持所属服务私有 |
| 示例系统目录位于顶层，rules 要求系统基础设施也有 services 归属 | 放 services/system；旧模板路径不作为新架构依据 |
| 示例路由以整个请求为事务 | 请求内只做短操作；worker 分开领取、模型调用、提交，防止长事务 |
| 示例错误响应输出原始异常信息 | 新实现使用稳定错误码和可读提示，内部详细错误仅写经脱敏的日志 |
| 前端 class 名可能被生产压缩改写 | 从规范消息类型名生成稳定元数据，不依赖 constructor.name |
| Tailwind 与生成主题运行时色值 | 静态布局/变体采用 Tailwind；若必要，仅给经过校验的色值使用 CSS 变量并记录理由 |

## 6. 规范检查如何交付

每次交付记录“规则编号 → 实现文件/类型 → 验证方式 → 结果”。检查目录、类职责、可见性、IO 边界及前后端一致性，再运行相关功能测试。

不制定无来源的类数量、文件行数、继承层数或覆盖率评分门槛。静态扫描用于发现 var、unsafeRun、SQL 暴露和越界 import 等候选问题，人工确认语境；测试行为正确也不能替代规范检查。

## 小猫陪伴增量证据

- 页面专用组件、偏好 store、effect hook、纯状态映射就近归属 BrowserPage；移除旧全屏进度 hook，任务状态不复制。
- companion 使用独立消息、单对象文件、final case class、封闭事件／状态／表情及编解码；Table 私有 SQL，公开 IO 方法；worker 网络请求不持有事务。
- 跨服务凭据通过 settings 公开 Message 获取，未引用其他服务私有 utils。CompanionModule 根文件是资源装配入口，与 GenerationModule 一致。
- 功能及测试证据见 [小猫陪伴](COMPANION.md)，不声称新增功能覆盖未提供的独立评分表。
