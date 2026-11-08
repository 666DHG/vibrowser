# 顶部对齐、保留旧页加载与书签验收

更新：2026-11-03。

## 当前行为

标签栏与导航栏均为 48px 高、全宽、相同左右边距。标签过多时仅标签列表横向滚动，导航按钮、收藏星标和书签入口保持可用。

从首页打开网页时使用全屏加载；已经显示网页或书签页时保留原内容，在右下角显示可折叠的进度面板。面板展示目标、等待耗时和实际阶段记录，支持失败重试、取消本次打开。成功后才替换页面并提交历史；失败或取消不推进历史。加载期间原页面可以继续滚动和点击，收藏仍针对当前显示的网页。刷新同一缓存页面不重置滚动位置。

每标签分别保存显示内容和待完成导航。新导航取消本标签旧请求，旧响应不能覆盖新目标。关闭标签只停止前端请求与轮询，已经开始的服务端任务仍可以完成并保存。会话升级为 `vibrowser.tabs.v2`，兼容旧多标签与单标签记录：恢复时先读取已显示页面，再查询已知 pageId 的待完成任务；尚未取得 pageId 的请求显示重试提示，不自动重新提交生成。

地址栏星标可收藏/取消收藏当前已加载网页，包括搜索结果页。导航栏书签按钮打开当前窗口唯一的书签标签，列表支持标题/地址筛选、倒序展示、删除。点击书签新建标签，直接用 pageId 读取原页面，不调用 Navigate/Retry。删除书签不删除页面。保存结果以数据库响应为准，窗口重新获得焦点或打开书签页时刷新，同浏览器窗口通过 BroadcastChannel 通知同步。

## 接口、数据与课程结构

| 消息 | HTTP | 输入与结果 |
| --- | --- | --- |
| ListBookmarksMessage | POST /api/listbookmarks | 空对象 → BookmarkListResponse |
| SaveBookmarkMessage | POST /api/savebookmark | pageId → Bookmark；由服务端读取页面标题/地址，拒绝未就绪页面 |
| RemoveBookmarkMessage | POST /api/removebookmark | bookmarkId → BookmarkRemovalResponse；重复删除返回 removed=false |

书签归属 browser 服务。BookmarkId、Bookmark 及响应分别是独立文件的 final case class，附伴生编解码器；消息继续采用构造参数和 `plan(connection): IO[Response]`。BookmarkTable/Initializer 独立，SQL 私有、表方法返回 IO。前端有一一对应的消息类和 send()，未增加转发 Service。

新增 `bookmarks` 表，保存 id、唯一 page_id、title、address、kind、saved_at。通过 page_id 唯一约束处理并发收藏，重复收藏保持原 ID 和保存时间。数据沿用 LIVE/Mock/测试 schema 隔离。

任务增加 `steps JSONB NOT NULL DEFAULT '[]'`，Initializer 使用幂等 ALTER。GenerationPhase 是封闭枚举，GenerationStep 保存阶段、尝试次数和时间；阶段与记录追加由同一条 SQL 原子更新。GetPage 返回完整记录，因此轮询不会漏掉已经经过的短步骤。阶段包括 queued/preparing/generating/validating/repairing/retrying/saving/ready/failed；最多两次模型请求与单次 60 秒限制不变。旧任务没有历史记录时仅展示已知状态，不补造阶段。打开已就绪缓存时不把过去的生成步骤显示为本次新生成。

前端以 BrowserTab.content 与 pending 分离显示和导航，NavigationProgress 负责展示，BookmarksPage 负责列表，useBookmarks 负责查询/变更及窗口通知；业务对象、状态、hook 和组件就近组织。页脚与生成内容协议保持原行为。

## 验证结果

- Scala 编译、格式检查及 **37 项测试**：增加书签并发去重、未就绪拒绝、删除不影响缓存、重复初始化、数据库 schema 隔离、旧任务迁移与中断记录；扩展生成预算测试，检查修复/重试顺序及次数。
- 前端 **29 项单测**：增加 v1→v2 迁移、书签内部视图恢复、旧页与待完成请求同时恢复；类型检查、生产构建与格式检查通过。
- 浏览器 **19 项回归**：原有 15 项加旧页保留/固定进度/失败重试/历史提交、待完成任务恢复与取消、首页全屏与等高布局、书签持久化/窗口同步/缓存打开。所有模型生成均使用 Mock 或拦截数据。
- LIVE 缓存验收分 prepare/restore 两阶段，中间实际重启应用和项目数据库。检查书签仍存在，页面与任务 ID、内容 SHA-256 不变；书签打开过程中 Navigate/Retry 请求为零，不产生新的模型调用。只清理由验收创建的书签，已有书签不改动。

证据：[真实缓存验收数据（原始证据已本地归档）](RELEASE.md#历史验收汇总)；[旧页与进度（原始证据已本地归档）](RELEASE.md#历史验收汇总)、[手机加载（原始证据已本地归档）](RELEASE.md#历史验收汇总)、[书签列表（原始证据已本地归档）](RELEASE.md#历史验收汇总)、[真实书签（原始证据已本地归档）](RELEASE.md#历史验收汇总)、[重启后打开（原始证据已本地归档）](RELEASE.md#历史验收汇总)。模拟截图只证明交互，真实缓存验收不等于新增 DeepSeek 生成验收。

## 复验

先启动 Mock，再运行 `scripts/check.ps1 -Browser`。真实缓存复验使用已有 `layout-generation-2026-11-03.json` 中的页面，无需额外模型调用：

```powershell
# 真实模式启动后，在 frontend 目录执行
$env:VIBROWSER_LIVE_SMOKE = 'true'
npm run test:live:bookmarks -- --grep 'prepare'
# 停止并重新启动应用与数据库后
npm run test:live:bookmarks -- --grep 'restore'
```

本轮不含书签文件夹、标签分类、云同步与网页快照版本。书签保存本机应用缓存的引用；浏览器会话仍按窗口隔离，书签则按应用数据库共享。
