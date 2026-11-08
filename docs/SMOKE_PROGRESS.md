# 首版 Smoke 验收记录

## 最新结果：真实 DeepSeek 已通过

2026-11-03 后续排查已修复嵌套组件简写、组件预算和修复提示问题。真实接口连接成功，6/6 页面任务成功（含原先 4 个失败页面）；历史/刷新无新增生成，重启后 6 个页面的 jobId 与内容哈希保持一致，配置及历史恢复。新增 6 项回归测试，后端总计 24 项通过。详见 [真实验收记录与截图](LIVE_SMOKE.md)。

## 首次交付历史快照

以下记录描述填写有效 Key 之前的状态，保留用于区分 Mock 与真实验收证据。

日期：2026-11-03。状态：**自动化与 Mock 已通过，真实 DeepSeek 验收待完成。**

## 已交付

浏览器式中文界面、地址/搜索输入、无图片 PageSpec 渲染、链接探索、前进/后退/刷新、历史恢复、设置/连接测试、DPAPI 密钥保护、兼容模型客户端、单 worker、PostgreSQL 缓存与失败恢复。源码、启动/停止/检查脚本、运行说明、roadmap 与截图均在仓库。

本轮没有调用收费模型，没有读取其他项目凭据。测试使用固定假 Key，结束后清除；截图为明确标注的 Mock 演示，不代表真实 DeepSeek 生成质量。

## 自动化证据

完整入口：`scripts/check.ps1 -Browser`，退出码 0。最后增加的非法 JSON 持续失败/额度场景已单独重跑 IntegrationSuite。

| 检查 | 结果 | 覆盖 |
| --- | --- | --- |
| Scala compile / scalafmtCheckAll | 通过 | Scala 3.3.7、消息签名、类型与格式 |
| ContractSuite | 8 通过 | 两个合法 fixture、五个非法 fixture、地址分类/端口/路径/搜索/非法协议 |
| IntegrationSuite | 4 通过 | PostgreSQL 并发导航去重、缓存、回滚、重复重试、迟到结果、启动中断恢复；配置加密/脱敏/清除；JSON 修复和耗尽、鉴权/额度、空输出/超时预算 |
| ProviderClientSuite | 4 通过 | 请求路径/鉴权/JSON mode/128 token 最小测试、官方 thinking 关闭与自定义字段兼容、错误脱敏、空/截断响应、超时资源取消 |
| CredentialSuite | 1 通过 | 当前 Windows 用户 DPAPI 实际加密/解密 |
| RouterSuite | 1 通过 | 外来 Origin、非 JSON 跨站请求被拒绝 |
| 前端 Vitest | 9 通过 | 共享 fixtures 与非法链接校验 |
| TypeScript / Vite build / Prettier | 通过 | 生产包构建及格式 |
| Playwright E2E | 4 通过，无跳过 | 输入、生成、相对链接、前后退、刷新、整页重载、搜索结果、设置保存/遮蔽/连接测试/清除、非法协议、迟到导航、390px 布局 |
| npm audit | 0 个漏洞 | 本轮安装并更新锁定依赖后的检查 |

后端总计 18 项，前端单测 9 项，浏览器 E2E 4 项。集成测试使用真正的 PostgreSQL 16，仅清理 smoke_test schema。ProviderClientSuite 使用受控 HTTP 客户端替身，不向外网发送 Key。

## 运行与重启实测

- start.ps1 成功启动前端 5173、后端 8787、项目 PostgreSQL 55432。
- stop.ps1 与随后再次启动在同一 PowerShell 会话完成；只根据 PID 与创建时间结束记录的进程。
- 修复 PowerShell 新版 ConvertFrom-Json 自动转换 ISO 时间的问题，比较 UTC ticks，避免遗漏应停止的进程。
- 对于不可见/其他会话的进程，停止脚本明确报错，不误报成功，也不按端口强杀。
- 创建 restart-persistence.example 页面，重启前后 pageId 同为 `0db4d2ad-c175-4406-ba70-97c15c7b2331`，仍为 ready/mock。
- 重启前保存的模型配置与加密凭据状态仍可读取；检查完成后清除假 Key 并恢复默认模型。
- 前端页面刷新会恢复最多 100 条历史中的当前页，页面内容来自数据库；不会因刷新隐式生成。
- Mock/真实/测试分别使用独立 schema；页面额外保存 source，避免混淆。
- 交付时已切回真实模式，/health 返回 mock=false，前端 HTTP 200，默认配置为 deepseek-flash 且 hasKey=false，等待用户在设置面板填写。

## 真实验收待办

请以默认真实模式启动，在设置面板填写有效 Key 后完成；不在聊天或文档中记录 Key。

| 步骤 | 待记录证据 | 当前状态 |
| --- | --- | --- |
| 测试连接 | provider、模型、jobId、成功/稳定错误码 | 待有效 Key |
| 输入 moon-coffee.example | 页面 ID、结构合格、可读内容、耗时 | 待有效 Key |
| 搜索“月球旅行” | 虚构结果列表、明确非真实搜索提示 | 待有效 Key |
| 点击结果 | 新网站生成，链接与上下文可用 | 待有效 Key |
| 后退、刷新 | 相同页面 ID、内容与 jobId，不新增调用 | 待有效 Key |
| 重启应用 | 配置状态和已有页面仍可读取 | Mock 已验证；真实模式待补 |

官方默认模型与 JSON/thinking 参数已依据公开文档核对，详见 [资料来源](SOURCES.md)。公开文档和 Mock 成功不能证明账户权限、额度、TokenHub 参数兼容或真实网页生成质量。

## 界面截图

- [首页（原始证据已本地归档）](RELEASE.md#历史验收汇总)
- [生成页面（文本插画）（原始证据已本地归档）](RELEASE.md#历史验收汇总)
- [虚构搜索（原始证据已本地归档）](RELEASE.md#历史验收汇总)
- [设置面板（原始证据已本地归档）](RELEASE.md#历史验收汇总)
- [移动布局（原始证据已本地归档）](RELEASE.md#历史验收汇总)

截图由 Playwright 生成，并检查了桌面内容、设置面板和窄屏布局。生成网站没有图片资源；交付截图属于测试证据。

## 阶段提交

| 提交 | 内容 |
| --- | --- |
| 5572b74 | 工程、消息 API、四表、前端骨架与契约 |
| 179f278 | 浏览器 UI、设置面板、受控 Renderer |
| e34dae4 | DeepSeek worker、加密设置与持久化生成 |
| 57a3559 | 任务/缓存恢复、强类型 ID、协议与 Smoke 测试 |
| 最终交付提交 | 启停/检查脚本、接口细节修复、截图、运行说明、roadmap 与本记录；具体 hash 见 git log |

此段为历史验收记录，当前发布状态见 [发布检查](RELEASE.md)。

## 实际限制

当前仅本机单进程、单 worker、单标签；不含虚构文件、生图、真实搜索、完整 SiteProfile。自定义接口须兼容 JSON mode；官方接口显式关闭思考以满足首版时间和连接测试预算。模型请求最多两次、每次 60 秒；进程崩溃后重试可能重复计费。较长队列超过前端轮询窗口后可刷新重新查询任务。

本机环境已验证；没有在全新 Windows 用户/机器重装验证。DPAPI 密文绑定当前 Windows 用户。Java 25 下 sbt 的 Unsafe/JNA 兼容警告仍会显示，但本轮编译、测试与应用运行成功。
