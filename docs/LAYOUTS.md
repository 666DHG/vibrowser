# 网站布局与内容丰富度验收

更新：2026-11-03。本轮针对所有页面近似“标题、字符画、两张卡片”的问题，扩展数据契约、Renderer 与生成提示，保留课程消息架构和缓存行为。

## 已实现

- 八种布局：classic、editorial、storefront、documentation、community、dashboard、studio、directory。杂志采用刊头、文章和短讯；商店采用分类与商品目录；文档采用目录侧栏、连续正文和代码；社区采用讨论串与板块侧栏。各布局有独立的栏宽、标题比例和内容表现。
- 四套字体栈：sans、serif、mono、display；三种密度、七种背景主题、六种强调色。字体使用本机字体与明确回退，具体字形随操作系统安装字体变化；数字使用等宽数字排版，代码保留缩进。
- 增加 section、list、article、product、thread、stat、quote、code、divider。文章、商品、讨论、代码分别渲染，不再统一套卡片。商品以文字海报表达视觉内容。
- 组件的数量、顺序、组合由内容决定；取消固定 hero/ascii/双卡片结构。网格可选 1–4 列，支持主栏、侧栏、通栏和强调变体。全树上限从 12 个/3 层扩展为 **48 个/4 层**，包括容器和全部子项。
- 相邻内容分组为连续主栏和连续侧栏，通栏块开启新的分区，解决长文档首段之后正文铺满整行的问题；小屏自动堆叠。浏览器外壳保持统一，网页自身有独立风格。
- Prompt 使用三种结构不同的短示例，并明确示例不是页面配方。子页先传递来源的标题、主题与字体摘要，再附有预算的正文片段，避免长页面截断掉风格字段。
- 页面输出预算改为 12,000 tokens；连接测试仍为 128。每任务最多两次调用、单次 60 秒的边界不变。

## 契约与课程实现

后端新增独立文件的 `PageDesign`、`BlockStyle` final case class，伴生对象提供编解码；`PageLayout`、`Typography`、`Density`、`Accent`、`BlockVariant`、`BlockPlacement` 为封闭 enum。`PageSpec.design`、`PageBlock.meta/style` 为可选扩展，旧缓存无需数据库迁移。`PageLimits` 统一后端计数与归一化深度，前端 Zod 和 JSON Schema 同步约束。

前端 `PageRenderer` 组织页面区域，`PageBlockView` 负责容器，`ContentBlock` 负责文章/商品/讨论等内容，`pageDesign` 负责纯样式选择与分栏计算；代码在 BrowserPage 附近组织，样式以静态 Tailwind 类实现，仅强调色和间距使用枚举映射出的 CSS 变量。没有引入转发 Service、自由 CSS/HTML 或新消息接口，原有 `plan(connection): IO[Response]` 保持不变。

协议继续接受旧 footer 以读取历史缓存，界面不渲染它。旧页面仍复用缓存，不会因本次升级自动重新生成。首页已加入下表四个新站点入口，可以直接查看本轮真实结果。

## 真实 DeepSeek 结果

使用已有的 DeepSeek 配置与密钥，在 LIVE 模式生成四个新地址；没有读取、输出或替换密钥。本轮 **4/4 页面任务成功**，组件数和结构均不同，四页均未使用字符画。耗时是浏览器提交到读取到成功状态的端到端时间，包含轮询等待。

| 地址 | 布局 / 字体 | 组件数（全树） | 耗时 | 截图 |
| --- | --- | --- | --- | --- |
| fieldnotes-journal.example | editorial / serif | 35 | 15.8 秒 | [桌面](screenshots/layouts-live/editorial.png) · [手机](screenshots/layouts-live/editorial-mobile.png) |
| stationery-shop.example | storefront / sans | 39 | 14.7 秒 | [桌面](screenshots/layouts-live/storefront.png) · [手机](screenshots/layouts-live/storefront-mobile.png) |
| docs.tidb-lab.example/quickstart | documentation / sans | 41 | 13.1 秒 | [桌面](screenshots/layouts-live/documentation.png) · [手机](screenshots/layouts-live/documentation-mobile.png) |
| forum.city-cycling.example | community / sans | 37 | 13.9 秒 | [桌面](screenshots/layouts-live/community.png) · [手机](screenshots/layouts-live/community-mobile.png) |

页面/任务 ID、主题、组件类型与毫秒耗时见 [原始验收数据](acceptance/layout-generation-2026-11-03.json)。修复长正文分栏后重新打开这四个缓存页，核对页面与任务 ID 未变化，重新截图并检查手机无整体横向溢出；原始生成耗时未被缓存读取耗时覆盖。提示中的最后文案与来源摘要调整由编译检查覆盖，本轮四页生成发生在这些微调之前。

## 自动检查

- Scala 编译及 35 项测试通过：共同 fixtures、地址处理、生成归一化、三个 Prompt 示例、模型失败/修复预算、PG 事务/去重/重试、DPAPI 与设置边界。
- 前端 22 项单测通过：18 个共享 fixtures、链接/路由规则、长文档分栏连续性和通栏分区保序；类型检查、生产构建与格式检查通过。
- Mock 浏览器回归 11 项：原有四项交互，加七类页面的桌面/手机渲染、字体、主侧栏几何关系和链接导航。截图在 [layouts](screenshots/layouts/)。
- 独立真实浏览器布局用例通过，含上述四次生成和移动端溢出检查；它与 Mock 测试分开。

复验命令：

```powershell
.\scripts\start.ps1 -Mock
# 另一终端
.\scripts\check.ps1 -Browser

# 停止 Mock、启动真实模式后；此命令可能产生模型费用
$env:VIBROWSER_LIVE_SMOKE = 'true'
cd frontend
npm run test:live:layouts
```

真实用例重复运行会优先命中缓存，并重写该验收 JSON 中的耗时；需要独立测量新生成时应使用新的测试地址和新的证据文件。四个站点是本轮样本，不代表所有输入的成功率。后续可增加页面内部交互、表格/时间线组件以及持久化 SiteProfile；当前子页风格继承依赖来源摘要，尚非完整站点设计系统。
