# 双模式与独立设置页

日期：2026-11-05。新页面继续使用 WebDocument v3；旧 PageSpec 与书签保持读取。

## 使用方式

地址栏选择「幻觉」或「认真」，再输入网址或主题。选择属于当前标签；新标签继承选择。切换不会改写正在显示的页面，也不会改变已经提交的任务。页面里的搜索和生成式更新沿用原页面模式；历史和书签恢复原页面模式。

认真模式理解输入描述，搜索和读取互联网资料，再组织成可交互网站。例如输入 `PostgreSQL 官方文档`，浏览器会先检索来源再整理页面。浏览器右上方「来源 N」打开来源面板，其中「查看原文」在真实网站的新窗口打开；正文普通链接继续在 Vibrowser 中探索。页面采用自然网站口吻，不附加免责声明或说明性页脚。

设置是 `vibrowser://settings` 内部标签。每个应用窗口只打开一个设置标签，左侧为 API 配置、项目说明；窄屏改为顶部导航。切换标签或栏目保留草稿，关闭设置标签丢弃草稿；密钥不进入会话存储。

页面生成仍支持 DeepSeek、TokenHub、自定义兼容接口。联网检索固定使用 DeepSeek 官方 Search / Fetch。官方生成地址可复用生成 Key，其他生成服务使用独立官方检索 Key。独立凭据通过当前 Windows 用户 DPAPI 加密；设置响应只有配置状态，没有密钥。

## 生成、资料与预算

- 首次入口先做一次种子搜索，再用一次轻量规划结合结果理解主题和机构限定。这个顺序让同名候选由已检索来源支持，避免为了候选再增加一次规划模型调用；种子搜索计入四次预算。
- 每次检索最多一次规划（30 秒）、四次 Search、六次 Fetch（每次 20 秒），检索阶段总预算 90 秒。v3 生成最多四次请求、每次 180 秒。网络失败和结构修复共用这四次生成预算（2026-11-05 调整）。
- 同站资料作为下一次规划的候选上下文；同主题且资料足够时直接复用，新增主题清除旧来源并重新搜索。跨模式不继承父页事实或检索上下文。
- 来源按完整条目裁剪到 24,000 字符；摘录按完整行保留。资料文本是数据，不能更改工具调用或 iframe 权限。正文 `data-source-id` 只能使用已分配编号。
- 部分 Fetch 失败时保留搜索摘要继续生成；搜索失败明确显示错误，空结果提示修改输入。不会自动转为幻觉模式。
- 关键同名身份无法区分时显示候选按钮。选择验证归属并幂等继续原任务。已经完成的检索快照在生成重试时复用。
- 本地筛选、排序、展开、规格等不调用模型。页内锚点执行本地滚动，即使模型额外声明 Navigate 也不会生成新页。

## 课程架构与接口

`BrowsingMode`、研究来源、候选、快照、摘要和设置均为独立数据文件；后端采用封闭类型、`final case class` 和伴生编解码器。新消息沿用 `plan(connection): IO[Response]`，前端为对应消息类和 `send()`。

| 消息 / HTTP POST | 职责 |
| --- | --- |
| Navigate / `/api/navigate` | 可选 mode，缺省 imagination；同模式地址查询与去重 |
| GetPage / `/api/getpage` | 页面、真实任务阶段、候选摘要；不发送完整来源摘录 |
| SelectResearchSubject / `/api/selectresearchsubject` | 验证候选并继续同一任务 |
| GetPageSources / `/api/getpagesources` | 按需读取来源元数据，摘录不出现在响应中 |
| GetResearchSettings / `/api/getresearchsettings` | 检索配置与可复用状态 |
| SaveResearchSettings / `/api/saveresearchsettings` | 保存复用方式或加密独立凭据 |
| ClearResearchCredentials / `/api/clearresearchcredentials` | 清除独立检索密钥 |
| TestResearchConnection / `/api/testresearchconnection` | 固定小查询，结果复用任务轮询 |

`GetResearchConnectionMessage` 是内部消息，不注册 HTTP。`ResearchSnapshotTable` 与 `ResearchSettingsTable` 各有 Initializer，SQL 私有，方法返回 IO。worker 在事务外调用工具和模型，用短事务保存快照、阶段与结果。没有添加转发 Service。

pages 的 mode 默认 imagination；旧记录和旧会话兼容迁移。查询及活跃任务去重使用 mode + address。动作模式从源页面读取，不接受客户端覆盖。书签引用不可变页面，因此同时保留模式、来源快照和交互状态；启动清理临时页面时通过外键清理孤立快照。LIVE、Mock、测试 schema 保持隔离。

## 检查与验收

自动化覆盖：模式隔离和迁移、DPAPI 往返与脱敏、候选归属/幂等、检索快照重用、部分 Fetch 失败、同主题零工具复用与新主题来源隔离、官方接口请求结构/错误/超时、v3 本地动作与页内锚点、模式切换和设置草稿、来源及书签模式恢复。

真实验收数据：[`acceptance/research-2026-11-05.json`（原始证据已本地归档）](RELEASE.md#历史验收汇总)。该文件保留每次任务的状态、耗时、来源和失败记录；截图在 [`screenshots/research`（原始证据已本地归档）](RELEASE.md#历史验收汇总)。不保存密钥。

真实联网连接测试成功，任务 `be418eb1-415b-4720-80f4-1f0def735c30`。三类认真模式初始页面最终 3/3 成功；第一条生成请求直接成功 1/3，计入任务内一次修复后为 2/3，机构页面在一次显式重试后成功。人物站内搜索、详情探索及同输入幻觉对照全部完成。

| 场景 | Search / Fetch | 本轮生成请求 | 耗时 | 结果 |
| --- | --- | --- | --- | --- |
| 袁洋个人主页 | 1 / 5 | 1 | 75.2 秒 | 首次成功，5 条来源 |
| 交叉信息研究院介绍，首次任务 | 1 / 6 | 2 | 495.6 秒 | 网络失败 |
| 同一机构页面，显式重试 | 0 / 0（复用） | 2 | 47.3 秒 | 一次结构修复后成功 |
| Transformer 注意力机制 | 1 / 6 | 2 | 95.1 秒 | 一次结构修复后成功，6 条来源 |
| 人物站内搜索：研究方向 | 0 / 0（复用） | 2 | 34.1 秒 | 一次结构修复后成功 |
| 人物相关详情 | 0 / 0（复用） | 2 | 47.1 秒 | 一次结构修复后成功 |
| 相同输入，幻觉模式对照 | 0 / 0 | 1 | 19.5 秒 | 成功，无来源记录，独立页面 ID |

每个新检索快照规划 1 次；已完成的机构快照重试没有再次规划。模型请求统计来自持久化阶段，检索统计见 [快照摘要（原始证据已本地归档）](RELEASE.md#历史验收汇总)。成功任务内的修复表示结构校验后的第二次生成，不视为第一条请求直接成功。阶段记录没有持久化每条修复提示，暂不对四次成功修复分别推断字段原因。

机构首次网络失败期间，记录到 495.6 秒墙钟等待，明显超过正常请求预算。当时的代码包含 60 秒取消超时，超时单测通过，但该次长尾的系统调度/网络原因未确认；保留原始阶段时间，不把它记为正常超时表现，也不声称已修复这个环境长尾。

页面检查：人物的姓名、清华交叉信息研究院副教授身份、AI+中医研究方向和邮箱与清华个人主页相符；没有按旧印象把新研究方向判为错误。来源面板实际打开原文并读取到姓名。三类页面分别呈现研究者履历/工作、机构栏目、带目录的知识解释，页面无“不保证”“仅供参考”类文案。原人物页面主要使用页内导航，因此交互链为主页站内搜索 → 搜索结果详情；后续生成提示已补充主题详情路径要求。

重新浏览六个页面的生成请求数均为 0，桌面与 390px 设置/来源面板未溢出；证据见 [页面复核（原始证据已本地归档）](RELEASE.md#历史验收汇总)。[正常重启验收（原始证据已本地归档）](RELEASE.md#历史验收汇总) 验证书签的 pageId、jobId、模式及来源列表不变，打开书签生成请求为 0。测试后删除了本轮测试书签，保留原有两条用户书签，应用恢复正常 LIVE，关闭保留临时页面的测试开关。

自动检查最终结果：73 项 Scala 测试（包括 PostgreSQL 与 DPAPI）、42 项前端单测，格式/类型/生产构建通过。浏览器共 34 个用例分旧格式 Mock 与默认 v3 Mock 运行：旧格式全量初跑 30 通过、1 个旧参数断言失败、2 个 v3 专用跳过；补入 mode 断言后定向复验通过，并新增未配置检索的设置定位用例；两个 v3 worker/检索用例另行通过。三项 LIVE 用例分别完成生成链、页面/来源复核、重启书签验收。

本轮修复包括：创建认真模式页面后的回查漏传 mode；异步设置初始化覆盖草稿；同主题重复 Fetch 与换主题混用来源；已声明 Navigate 的页内锚点误触发生成；从错误入口打开设置时定位联网检索；书签错误提示中重复渲染来源面板。

提交阶段：`0198a94` 模式与独立设置页；`4256a11` 检索、凭据、候选与来源闭环；最后的回归与验收提交见 Git 记录。

## 复验命令

```powershell
# 后端停止后执行，避免运行进程加载到不同编译版本
.\scripts\database.ps1 start
.\scripts\sbt.ps1 scalafmtCheckAll test writeRuntimeClasspath
npm.cmd --prefix frontend run format:check
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend test

# 旧 v1/v2 回归：启动前设 VIBROWSER_LEGACY_MOCK=true，再 start.ps1 -Mock
# frontend 下运行 npx.cmd playwright test；两个 v3 专用用例在这里跳过。
# 停止服务，清除 VIBROWSER_LEGACY_MOCK 后重新 start.ps1 -Mock。
# 默认 v3 Mock 启动后，从 frontend 执行
$env:VIBROWSER_V3_MOCK_SMOKE='true'
npx.cmd playwright test tests/e2e/modes.spec.ts tests/e2e/research.spec.ts tests/e2e/research-ui.spec.ts tests/e2e/web-runtime.spec.ts tests/e2e/web-worker.spec.ts

# LIVE 启动且官方凭据可用，从 frontend 执行；包含计费调用
$env:VIBROWSER_LIVE_SMOKE='true'
npx.cmd playwright test --config playwright.live.config.ts research.spec.ts
```

## 界面

[认真模式个人主页（原始证据已本地归档）](RELEASE.md#历史验收汇总)

[独立设置页（原始证据已本地归档）](RELEASE.md#历史验收汇总)

## 后续

继续扩大产品与知识主题样本、优化来源排序和检索延迟，增加更细的来源发布时间与读取失败记录。当前检索快照沿点击路径复用，不是全站共享知识库；未增加外部资源加载、模型 JavaScript、账户体系或远程发布。

接口依据：[官方 Search](https://api-docs.deepseek.com/api/search/)、[官方 Fetch](https://api-docs.deepseek.com/api/fetch/)。人物事实抽查依据：[袁洋的清华大学个人主页](https://people.iiis.tsinghua.edu.cn/~yuanyang/index.html)。


2026-11-05：已显式配置 HTTP 客户端等待预算，外层生成请求为 180 秒、响应头等待 190 秒、读写空闲 200 秒。新增针对性成功率验收见 [生成可靠性修复](GENERATION_RELIABILITY.md)；这不追溯宣称解决上面未确认的系统长尾。
