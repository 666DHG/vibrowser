# WebDocument v3 实施与验收

更新：2026-11-05。新生成默认使用自由 HTML/CSS 文档；旧 PageSpec v1/v2 与书签继续通过原 Renderer 读取。

## 实现

- `WebDocument` 保存 HTML/CSS、站点风格、实体、叶节点字段绑定、封闭动作、初始状态及可收藏状态键。`pages.document` 与 `spec` 对 ready 页互斥。
- 隔离 iframe 运行宿主脚本，处理导航、站内搜索、表单、展开/切换、筛选/排序、规格与购物车。生成脚本、事件属性、外部资源不执行；HTML 用 jsoup、CSS 用 ph-css 解析后校验。iframe 消息检查来源窗口、实例和已声明动作。
- `SubmitPageActionMessage.plan(connection)` 从保存文档读取动作，检查版本、表单字段与 requestId；`page_actions` 保存不可变动作快照，重复请求幂等，失败重试使用原快照。
- Search 生成本站 `/search?q=...`；Submit/Replace/Append 只更新声明区域，生成新的页面 ID。区域外 DOM 保留，输入与滚动不会因整页重建而丢失。区域更新复用原 CSS，若模型另交 CSS 则要求修复，不静默丢弃。
- 模型在事务外调用，每任务最多两次请求、每次最多 60 秒。页面、任务与书签写入短事务；书签首次 INSERT 原子保存声明状态，重复收藏不覆盖原快照。
- 新搜索可以取代尚未完成的旧搜索；迟到响应不能改写新页面。会话历史保存版本、状态、草稿及滚动；书签仅保存 persistentKeys 声明状态。重启清理未收藏页面及动作任务，保留书签。
- HTML/CSS 合计 120000 字符、2000 DOM 元素、24 层、64 动作、128 实体。点击路径沿用 24000 字符上下文预算与最近三层祖先，跨站不继承原站实体。未知格式和事实冲突走有限修复。

课程组织：独立数据类/枚举/编解码、Message.plan、每表 Table/Initializer、私有 SQL、前端 API.send 与页面附近 hooks；没有转发 Service。详见 [课程规范](COURSE_STANDARDS.md)。

## 自动化结果

| 检查 | 结果 |
| --- | --- |
| Scala 编译、scalafmt、单元与 PostgreSQL 集成测试 | 66/66 通过 |
| 前端单测 | 42/42 通过 |
| Prettier、TypeScript、生产构建 | 通过 |
| 旧页面、书签、布局、实体、标签、加载面板与 v3 浏览器回归 | 28/28 通过 |
| 默认 v3 Mock worker → 追加 → 幂等重复 → 原版本不变 → 本站搜索 | 1/1 通过 |

新增检查包含危险 HTML/CSS、重复 ID、无效引用与预算、三类手写 fixture、区域外节点身份不变、草稿恢复、失败保留、中文输入法选词不提交、连续搜索最新结果优先，以及书签状态与清理。旧浏览器测试原来用相同标题判断前进已完成；保留旧页加载后这个条件不足，现改为检查历史已提交到目标地址再刷新。

## 真实 DeepSeek 结果

模型：已有 LIVE 设置中的 `deepseek-flash`。没有改写密钥或输出密钥。Mock 结果不计入下表。

六个初始任务**第一次模型请求成功 2/6（33.3%）**；同任务单次修复后仍为 **2/6**。修复应用协议兼容问题后，对失败任务显式重试，最终 **6/6 ready**。这些不是六个新样本的首轮全成功；原错误、每次任务 ID、阶段、请求次数与耗时均保留。

| 页面 | 最初任务结果/耗时 | 修复应用后重试 | 最终 |
| --- | --- | --- | --- |
| 论坛 1 | 失败，65.3s，2 请求 | 失败 38.4s/2 请求；补充表单修复后 49.0s/2 请求 | ready |
| 论坛 2 | 失败，63.6s，2 请求 | 37.5s/2 请求 | ready |
| 商店 1 | 成功，32.4s，1 请求 | 无 | ready |
| 商店 2 | 失败，55.1s，2 请求 | 36.7s/2 请求 | ready |
| 文档 1 | 成功，36.7s，1 请求 | 无 | ready |
| 文档 2 | 失败，43.6s，2 请求 | 34.5s/2 请求 | ready |

六个案例及显式重试共记录 20 次模型请求。更早的四个协议诊断失败另存 initial-failures 文件，不混入这个分母。开发中曾在运行进程使用 target/classes 时编译，导致类文件短暂缺失、进程中断；之后统一先停服务再编译，该中断不记为模型格式失败。

修复原因：字符串状态/动作数值简写、实体中文域名规范化、遗漏的普通链接动作、提交按钮上的动作提升到 form、常用 HTML 属性/文本标签兼容，以及可定位到元素的修复错误。未通过删除危险内容或截断页面来制造成功。

真实交互：

- **论坛：**本站搜索“选课” → 帖子详情 → 展开回复 → 追加内容；核对标题、作者及回复数继承，追加生成独立版本。
- **商店：**第一版商店筛选/排序 → 灰釉茶碗详情 → 规格选择 → 购物车。第二版商店缺少筛选/排序，记录为生成交互覆盖不足，未把换用第一版说成第二版通过。商品详情继承价格；后续本地操作零生成请求。
- **文档：**展开目录 → 搜索“快速开始” → 章节详情。搜索曾因文本标签校验失败，经修复后使用同一快照重试成功；结果跳转及事实核对通过。
- **收藏重启：**收藏商品时购物车为 1；正常 LIVE 重启后从书签新标签打开，pageId/jobId 保持不变、购物车为 1、生成请求数为 0；未收藏论坛页面查询返回 404。该测试书签验收后移除，原有书签保留。

交互记录共有 8 个不同任务、13 次模型请求，包含一次失败任务及其重试；重复读取同一个任务不计为新样本。三种布局已逐张核对：论坛帖子流/侧栏、商店衬线字体/商品网格、文档目录/表格/代码区，差异并非仅换颜色。

## 证据

- [初始六案例与重试](acceptance/web-documents-2026-11-05.json)
- [更早的协议诊断失败](acceptance/web-documents-initial-failures-2026-11-05.json)
- [真实交互任务](acceptance/web-interactions-2026-11-05.json)
- [收藏与重启结果](acceptance/web-bookmark-2026-11-05.json)
- [论坛截图](screenshots/web-documents/forum-1.png)、[商店截图](screenshots/web-documents/shop-1.png)、[文档截图](screenshots/web-documents/docs-2.png)、[重启书签截图](screenshots/web-documents/bookmark-restart.png)

## 复验

```powershell
.\scripts\database.ps1 start
.\scripts\sbt.ps1 scalafmtCheckAll test writeRuntimeClasspath
npm.cmd --prefix frontend run format:check
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend test
```

旧 v1/v2 E2E：停止服务，设置 `VIBROWSER_LEGACY_MOCK=true` 后 `start.ps1 -Mock`，运行 tests/e2e 除 web-worker 的用例。默认 v3 worker：清除该变量后重新启动 Mock，设置 `VIBROWSER_V3_MOCK_SMOKE=true`，运行 web-worker.spec.ts。两套模式均只读取 demo schema。

真实用例在 tests/live/web-*.spec.ts，需显式设置 `VIBROWSER_LIVE_SMOKE=true`。这些测试会调用模型；review/restart 只读。重试与交互脚本引用验收 JSON 中的任务 ID，正常重启已清理未收藏任务，需要重新执行初始生成才能重复整套验收。联调时曾使用 `VIBROWSER_KEEP_TEMPORARY_FOR_TEST=true` 保留任务以复测；最终运行已清除此变量，正常执行临时清理。

## 本轮边界

不执行模型 JavaScript、不加载外部图片/字体、不做真实支付。局部更新使用现有 CSS 类；本地状态是声明式字符串键值，不等于完整电商业务逻辑。布局自由度已提升，但模型仍可能遗漏某种交互或需要修复，特别是商店第二版的控件缺失需要后续扩大样本治理。当前只做点击路径继承，不建立全站共享记忆。
