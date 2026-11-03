# 加载动效、链接预览与点击路径继承

验收日期：2026-11-03。本轮已完成，最终运行模式为 LIVE。

## 交付行为

- 浮动加载面板延迟 150ms 出现，180ms 轻微弹入，完成提示保留 1.8s 后以 140ms 淡出。取消也保留退场时间；新的 requestId 会取消旧计时器。轮询不会重播入场。
- 面板头部和操作区固定，正文是唯一纵向滚动区域；预留 scrollbar gutter、裁切横向溢出，旋转图标使用固定尺寸容器。长网址、重试阶段和错误正文仍可滚动读取。
- 新页面成功替换时整体淡入 120ms，标签切换和轮询不会重新播放；减少动态效果偏好同时停用这些动画和旋转效果。没有引入动画依赖。
- 生成页、首页入口和书签条目支持左下角目标预览；悬停与键盘聚焦均可触发。滚动、离开、失焦、开始导航、切换标签及元素卸载会清除；滚动后再次移动鼠标可恢复预览。相对链接使用当前显示页解析，同一函数用于点击提交。
- 非首页加载继续保留旧页、滚动位置和历史；详情生成失败不会覆盖旧内容。

## v2 协议与课程实现

`NavigateMessage(input, referrerPageId, sourceBlockId)` 保持 `/api/navigate` 路径。新增参数可省略；手工输入没有点击来源，独立生成。已有地址优先返回缓存，来源变化不会改写缓存。

后端从父页实际组件树查找 sourceBlockId，并核对其 target 与本次规范地址。`NavigationContexts` 在 browser 服务内提取所选条目、容器摘要、站点外观、实体与最近三层祖先摘要，写入 `pages.navigation_context JSONB`。迁移可重复执行，旧行保持 NULL。父页面和任务的创建仍在同一短事务中，重试仅替换任务代次，使用原快照。

正文上下文预算为 24,000 字符；优先保留所选条目和目标实体，超出时依次删除低优先级实体、容器及较早祖先条目，不截断 JSON。跨站只携带所点击条目描述，清空品牌、实体事实和祖先摘要。原来的父页块 JSON `.take(16000)` 已删除；模型请求由 target/navigationContext 组成。

新生成页面使用 `schemaVersion: 2`。PageSpec 增加 `entities`、`subjectEntityId`；PageBlock 增加 `entityId`、`replyRange`。EntityKind 为 thread/article/product/page；实体 ID 是规范化目标 URL，保存标题、摘要、作者、时间、回复总数、结构化价格及可选旧式 meta。新增数据记录均为单独文件的 final case class 与伴生编解码器，种类采用 enum。

`InheritedContent` 是 generation 内部纯函数：缺失的已知实体/字段补齐；已知标题、摘要、作者、日期、回复数、价格或旧 meta 的显式冲突产生 invalid_content，进入现有唯一一次修复，仍冲突则失败。v1 的未解析 meta 原样保存，禁止推断补写作者/回复数等结构化字段。

`EntityValidation` 校验实体 URL、唯一性、引用、目标匹配以及回复范围。前端 Zod 和共同 fixtures 同步覆盖；`bindEntity` 确定性渲染绑定标题与事实，列表使用实体摘要，详情正文可独立展开。回复总数与展示数量分开，例如总共 5 条，本页显示 1–3 条。新实体不重复写 legacyMeta；已有结构化字段的页面也不会重复展示同一条 meta。

PageTable/Initializer 维护字段和私有 SQL；消息保持 `plan(connection): IO[Response]`，前端对应 API 类 `send()` 增加参数。没有新增只做转发的 Service 或 HTTP 接口。全树仍为 48 个组件、4 层，任务最多两次模型请求、每次 60 秒。

## 自动验证

| 检查 | 结果与范围 |
| --- | --- |
| Scala 编译、Scalafmt、测试 | **53 项通过**；契约、上下文、缺失补齐/冲突、有限修复、PostgreSQL 快照与重试一致性、原有设置/书签/任务回归 |
| 前端格式、单测、类型与生产构建 | **41 项单测通过**；共同 fixtures、绑定事实/正文、范围显示、URL 解析、会话兼容 |
| 完整浏览器回归 | **23 项通过**；原有标签/窗口/书签/布局，加进度压力、预览和 v2 实体导航；最终显示修复后相关 7 项再次通过 |
| 滚动稳定性 | 1440×1000、390×844、390×400，分别采样 90 帧；每种视口仅一种尺寸，面板/正文均无横向溢出。低高度正文 147px，内容 580px，可正常纵向滚动 |
| 旧格式 | 所有原 v1 fixtures 仍通过；未重建已有页面，未改写书签内容 |

[滚动尺寸记录](acceptance/scroll-stability-2026-11-03.json)保存各视口采样结果。初始短探测未复现用户全部环境下的持续闪烁；本轮移除嵌套滚动并针对长网址、完整重试步骤与旋转周期验证，没有把未复现的现象声称为已定位的唯一根因。

## 真实 DeepSeek 验收

官方接口 `https://api.deepseek.com`，模型 `deepseek-flash`；沿用设置中已有 Key，测试不读取或替换密钥。

首次访问 `forum.moon-night.example/boards/night-shift-20261103`，再依次点击 `/threads/3021`、`/threads/3023`。三个新页面均一次模型请求完成，没有修复或网络重试：

| 页面 | 实际首次加载耗时 | 核对结果 |
| --- | --- | --- |
| 夜班留言板 | 10,882ms | v2、community 布局、midnight 主题、品牌“月夜论坛” |
| 三楼空调异响，已报修 | 9,928ms | 标题与摘要逐字一致；作者“夜行者”、回复总数 5、发布时间不变；本页展示回复 1–3 |
| 夜间巡逻路线微调（临时） | 9,217ms | 标题与摘要逐字一致；作者“老周”、回复总数 3、发布时间不变；品牌延续 |

页面/任务 ID、实际提交的组件 ID、上下文摘要与字符数、完整阶段记录见 [真实验收 JSON](acceptance/continuity-2026-11-03.json)。记录保留了第一次 UI 验收在第二次点击前因自动滚动清除预览而失败的结果；当时前两个模型任务均成功。修复悬停处理和测试滚动时序后，重启应用读取前两页缓存，再生成第三页，连续路径通过。复验中明确标注 cacheHit，没有把缓存读取计为新生成成功。最终修复编译后再次重启，三页全部从缓存读取，页面/任务 ID 不变；健康接口为 mock:false。

截图：[列表](screenshots/continuity/listing.png)、[帖子详情](screenshots/continuity/thread.png)、[后续帖子](screenshots/continuity/onward.png)、[桌面加载](screenshots/continuity/progress-1440-1000.png)、[手机加载](screenshots/continuity/progress-390-844.png)、[低高度加载](screenshots/continuity/progress-390-400.png)。

执行方式：

```powershell
.\scripts\check.ps1
# Mock 模式下运行完整浏览器回归
cd frontend
npm.cmd run test:e2e
# LIVE 模式下显式运行真实路径验收；相同地址已有缓存时直接复用
$env:VIBROWSER_LIVE_SMOKE = 'true'
npm.cmd run test:live:continuity
```

## 边界与后续

一致性沿点击路径与保存的上下文传递，没有新增全站记忆。已缓存内容优先命中，不根据后来的来源覆盖，也没有快照版本/重建入口。结构化事实有明确冲突校验；自由正文中所有自然语言事实的语义一致性不属于本轮确定性校验范围。

后续再考虑站点级 SiteProfile、完整实体关系、复杂表单 Action；本轮不新增图片、文件、全站共享记忆或新的模型供应商协议。

提交节点：`91841d4` 动效与链接预览；`cd10e8c` v2 与点击上下文；最后一笔提交包含真实验收中发现的显示修复、本记录、截图和路线更新。
