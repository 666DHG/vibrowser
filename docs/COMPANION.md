# 小猫陪伴与独立开发

浏览器外壳右下角常驻原创像素小猫。气泡共用真实导航任务，不读取生成 iframe 内的自由文本，不推断用户情绪。

## 使用

- 导航时自动出现紧凑气泡；点击小猫或展开按钮查看步骤、耗时和取消操作。
- 失败、检索候选选择自动展开，保留重试、设置入口和选择操作；成功气泡 3 秒后关闭。
- 首页加载保持首页内容；隐藏小猫后使用同一进度组件，不丢失操作入口。
- 空闲时点击小猫得到短回应，收藏／成功浏览偶尔触发主动反馈。自动发言至少间隔 60 秒，点击至少间隔 3 秒，普通气泡保留 6 秒。
- 设置 → 小猫陪伴：显示、自动发言、AI 三个开关；保存在本机 localStorage，跨窗口同步。不保存闲聊记录。
- AI 默认允许，有模型凭据才尝试；Mock 可以模拟回应。AI 最多每窗口两分钟一次，失败保留本地台词。关闭主动发言不影响进度。

## 边界与结构

页面附近的组件、hook、store 和纯函数分别负责显示、副作用、偏好、状态映射。浏览器任务仍是唯一进度来源；桌宠不复制任务。隐藏窗口、切换标签、关闭 AI、开始新任务后取消／丢弃旧回应。

`companion` 服务公开 RequestCompanionReplyMessage、GetCompanionReplyMessage。输入为事件、最多 200 字符已提交主题、最多 100 字符标题及浏览模式；不含密钥、页面正文和表单。响应含 id、封闭状态、可空纯文本和封闭表情。

独立数据库临时队列最多 8 个活动任务，单 worker，不占用网页生成队列。每次 provider 调用限时 8 秒、无重试、回应最多 40 个 Unicode 字符，响应体最多 16 KiB。网络等待在事务外；异常仅导致本地台词回退。任务启动时清理，运行中删除超过两分钟的记录。停用前已发出的服务端请求可能运行至超时，但不再显示结果。

像素素材为 imagegen 生成并修正透明背景的 3×2 PNG，六种表情以 CSS 帧定位及轻动画表现；支持减少动画偏好。未引入远程素材依赖。

## 独立工作树运行

工作树：`../Vibrowser-companion`；分支：`feat/browser-companion`。首次从已提交的 `29a445f` 创建，原目录未提交工作不迁移。

```powershell
.\scripts\start.ps1 -Mock -UiPort 5174 -ApiPort 8788 -DbPort 55433
.\scripts\stop.ps1
```

默认端口仍为 5173 / 8787 / 55432。新工作树拥有独立 node_modules、构建产物、.cache、.data/postgres 和运行记录。stop 读取记录中的端口与根目录，并核验 PID 创建时间；不会停止原目录实例。数据库命令有互斥锁，并拒绝不完整初始化目录与已存在数据库的端口不一致。

若本机 Java 25 报 `Unable to establish loopback connection`，本次验收使用 JDK 在 Unix socket 不可用时的 TCP 回退，仅在当前 PowerShell 设置：

```powershell
$env:JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir=' + (Join-Path (Get-Location) '.cache/tcp-selector-fallback')
# 此路径应保持不存在，以使 JDK 回退 TCP；不修改系统 Java 配置。
```

独立测试需明确端口，停止本工作树后执行后端构建：

```powershell
$env:VIBROWSER_DB_PORT = '55433'
$env:VIBROWSER_UI_PORT = '5174'
$env:VIBROWSER_API_PORT = '8788'
.\scripts\check.ps1
```

## 验收证据

- Scala 102 项通过，包括并发队列上限、过期清理、8 秒超时无重试、等待模型时四个数据库连接仍可同时取得、Mock 完成和过大响应拒绝。
- 前端 46 项单元测试通过；格式、类型与生产构建通过。
- 气泡／进度／候选选择／多标签 17 项浏览器测试通过；另一次桌宠及 v3 交互 10 项通过（有重叠，不相加）。
- `docs/acceptance/companion-isolation.json`：双实例健康、不同数据库目录、独立生成收藏、停止后原实例健康、重启后新实例书签保留。
- `docs/acceptance/companion-scroll.json`：桌面与窄屏长步骤滚动稳定；`docs/screenshots/companion/` 保留布局截图。
- 未使用真实付费模型验证台词质量；真实请求的失败、限时与输出边界通过可控客户端测试。
