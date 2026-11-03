# Vibrowser

> Browse what exists. Imagine what doesn't.

本地运行的 AI 虚构浏览器。输入网址或搜索词，生成结构化网页，点击链接继续探索；前进、后退、刷新均复用已保存的页面。首版 Smoke 已通过真实 DeepSeek 验收：本轮 6 个页面任务全部成功，包含原先失败页面的重试，并验证了重启恢复。详见 [真实验收与问题修复](docs/LIVE_SMOKE.md)。

![浏览器首页](docs/screenshots/home.png)

## 启动

已验证环境：Windows、Node.js 22.19、Java 25、PostgreSQL 16。Scala 3.3.7 / sbt 1.11.7 由项目脚本管理；前端依赖由 package-lock.json 固定。需要 java、node、npm 可从 PATH 调用。

在项目目录运行 PowerShell：

```powershell
# PostgreSQL 默认使用这套已安装程序；其他机器需修改此环境变量
$env:VIBROWSER_PG_BIN = 'D:\Installs\PostgreSQL\16\bin'
.\scripts\start.ps1
```

首次启动自动安装前端依赖、下载 sbt、编译后端并初始化数据库，可能需要几分钟。打开 **http://127.0.0.1:5173/**。后端只监听 127.0.0.1:8787，数据库只监听 127.0.0.1:55432，不修改已有的 5432 实例。

```powershell
.\scripts\stop.ps1                 # 停止记录的应用进程和项目数据库
.\scripts\start.ps1 -Mock          # 不调用模型、无需 Key 的固定样例演示
.\scripts\start.ps1 -SkipBuild     # 源码未变时跳过编译
.\scripts\start.ps1 -Wait          # 当前终端保持等待，适合开发工具会话
```

切换模式前先停止旧实例。脚本拒绝占用中的端口，不结束不属于本项目的进程。请在启动应用的 Windows 用户/会话中停止应用；若开发工具隔离了进程，需结束原启动终端。

## 配置模型与真实验收

1. 点击右上角“设置”，选择 DeepSeek 官方、TokenHub 或自定义兼容接口。
2. 确认 Base URL 与模型名，填写 API Key，点击“保存设置”，再“测试连接”。
3. 输入 `moon-coffee.example`，等待网站生成。
4. 输入“月球旅行”，点击一个虚构搜索结果，再后退和刷新。
5. 停止并重新启动应用，确认配置和缓存仍可读取。

官方预设为 `https://api.deepseek.com` / `deepseek-flash`；TokenHub 预设为 `https://tokenhub.tencentmaas.com/v1` / `deepseek-v4.1-flash`。模型允许编辑，以账户实际权限为准。Base URL 不包含 `/chat/completions`，后端会自动追加。自定义接口需要兼容 chat completions、JSON mode 和非流式响应。

密钥通过 Windows 当前用户 DPAPI 加密，保存到本机 PostgreSQL。设置查询只返回 URL、模型、revision 与 hasKey；浏览器仅在填写时短暂持有明文，不保存到 localStorage。更换地址必须重新填写 Key。密钥不能随数据库复制到其他 Windows 用户后直接解密。

Mock 的测试连接与生成均为模拟，连接测试结果在设置中说明；真实模式不会读取 Mock 缓存。没有有效 Key 时，真实模式给出可重试错误，不回退到假生成。

## 本版能力与限制

- 单标签中文浏览器外壳、地址栏、前进/后退/刷新、设置面板、生成进度、失败重试。
- 裸域名、路径与 HTTP(S) URL 规范化；普通文字生成虚构搜索结果。地址仅作为创作素材，不抓取网址，也不执行真实搜索。
- PageSpec JSON 渲染导航、标题、文本、卡片、网格、按钮、搜索结果和文本插画；4 种主题。最多 12 组件、3 层嵌套，不执行生成代码或加载生成图片。
- 浏览器与生成页面取消说明性页脚；生成文案采用站点自身口吻，直接呈现品牌、栏目和正文。旧 footer 类型仅保留协议兼容，不渲染。此次缓存清理及验证见 [界面与文案调整](docs/IMMERSIVE_COPY.md)。
- 单 worker；一次页面任务最多 2 次模型请求，每次最多 60 秒。鉴权、额度、限流错误立即失败。等待较久可刷新查看状态。
- 短事务、缓存、并发去重、代次检查与重启恢复。重启后 running 任务变为失败，可显式重试；queued 任务继续领取。
- 本版不含虚构文件、生图、多标签页、完整站点世界设定、真实互联网搜索、部署与账户体系。模型调用不承诺严格只计费一次。

## 数据与配置

项目运行数据全部位于 Git 忽略目录：

| 位置 | 用途 |
| --- | --- |
| `.data/postgres` | 独立 PostgreSQL 实例，数据库 vibrowser |
| `.data/*log`、`.data/runtime.json` | 启动日志、带创建时间的进程记录 |
| `.cache` | sbt / Maven / Playwright 缓存、编译运行 classpath |
| 浏览器 localStorage | 最多 100 条导航记录，不含密钥 |

数据库分别使用 `vibrowser_live`（真实）、`vibrowser_demo`（Mock）、`smoke_test`（集成测试）schema，每个业务 schema 仅四张表：pages、generation_jobs、provider_settings、provider_credentials。开发初始化为仅限本机的 trust 认证；此配置不用于部署。

可选后端环境变量：`VIBROWSER_DB_URL`、`VIBROWSER_DB_USER`、`VIBROWSER_DB_PASSWORD`。启动脚本不会自动读取 .env；请在 PowerShell 中显式赋值。使用自定义数据库时必须自行准备权限和独立 currentSchema。Key 通过设置面板管理，不需要环境变量。

## 验证

```powershell
.\scripts\check.ps1                # Scala 格式/编译/24 项测试，前端格式/9 项测试/类型/构建
# 先用 start.ps1 -Mock 启动，再运行：
.\scripts\check.ps1 -Browser       # 另加 4 项 Playwright E2E，并更新截图
```

数据库测试只清理 `smoke_test` schema。E2E 强制检查 Mock 模式，不进行计费调用；若已有 Key，跳过会替换凭据的 UI 用例。真实验收另用显式启用的 `npm run test:live`，不读取或替换 Key；调用方式、重启阶段和结果见 [真实验收记录](docs/LIVE_SMOKE.md)。首次交付的历史证据见 [Smoke 记录](docs/SMOKE_PROGRESS.md)。

## 代码入口

后端按课程要求组织在 `services/browser、generation、settings、system`。每个 API 是独立消息类，输入作为构造参数，执行入口为 `plan(connection: Connection): IO[Response]`；表方法返回 IO，私有 SQL 位于对应方法前。前端使用对应消息类的 `send()`。

- [开发路线与后续范围](docs/ROADMAP.md)
- [架构与接口](docs/ARCHITECTURE.md)
- [课程规范与实现证据](docs/COURSE_STANDARDS.md)
- [资料与 API 核验](docs/SOURCES.md)
- [生成页面](docs/screenshots/generated-page.png) · [搜索](docs/screenshots/search.png) · [设置](docs/screenshots/settings.png) · [移动布局](docs/screenshots/mobile.png)

源码与中文文档为 UTF-8。本地 Git 用户为 666DHG / 47705871+666DHG@users.noreply.github.com；未创建远程仓库或发布网站。
