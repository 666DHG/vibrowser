# 设计评审与两挡思考验收

日期：2026-11-08。分支：`feat/content-driven-design`。本轮修复交互和评审误判，提供标准／深入两挡，并对设计指导做固定输入对照。轻微生成不足只记录，不逐项追加提示词或拒绝整页。

## 已实现与验证

| 要求 | 当前证据 |
| --- | --- |
| 复制确实调用宿主剪贴板，失败不伪报成功 | `Copy` 封闭动作与 iframe 消息验证；三类运行时 fixture 覆盖失败、重试、准确文本。使用隔离剪贴板适配器，不读写用户剪贴板。复制先取原文再更新反馈，真实样本回放发现的顺序问题已修复。 |
| 评审区分动作契约与审美偏好 | `DesignIssueCategory`；Search 不要求本页 region；仅有证据的主要障碍触发改进。v3 设计／评审说明合计 678 字符，未加入模板或风格菜单。 |
| 指定触发错误可以纠正，正常正文重排不误拒 | `DesignPreservationSuite` 与保存的真实 HTML fixture；保留动作身份、用途、实体和正文覆盖，仍拒绝删正文或无关动作修改。只读真实回放见 [保护检查](acceptance/effort-review-replay.json)。 |
| 标准／深入是独立于幻觉／认真的选项 | 官方请求分别 disabled、enabled/high；标签、在途任务、动作、历史与书签保存档位。自定义接口未经验证不发送深入参数，不静默降档。 |
| 档位隔离与兼容 | `GenerationEffort` 独立枚举／codec，旧记录默认 standard；数据库按模式、档位、地址去重；101 项 Scala 检查包含数据库回归。 |
| 深入请求容量及等待预算 | 标准 24,000／深入 48,000 输出上限；单次生成 180／600 秒；前端等待 30／90 分钟，按提交快照决定。31／91 分钟时间跳转回归通过。两例原截断输入在新容量下单次正常结束。 |
| 不泄漏思考或凭据 | 客户端只取 content；报告记录请求参数、usage 和失败信息，不保存 reasoning_content 或密钥。 |

当前代码 Scala 格式与 101 项测试通过；前端格式、42 项单测、类型／生产构建通过。最新运行时与档位浏览器定向 8 项通过。最终旧格式 Mock 回归 36 项通过、2 个 v3 专用用例跳过；随后 v3 Mock 11 项全通过，包含跳过的用例及 v3 书签。两批合起来覆盖当前 39 个浏览器用例，重复执行的用例不计作独立覆盖。详见[浏览器结果](acceptance/effort-browser-regression.json)。

## 固定真实对照

六个主题：学术主页、文案工具、日期、器具对比、PostgreSQL 文档、个人随笔。同题复用输入、日期和检索资料，每组一次固定工作流，保留失败，不重抽样选好页面。

| 组别 | 最终成功 | 首轮结构通过 | 已记录模型请求 |
| --- | --- | --- | --- |
| 旧指导／标准 | 6/6 | 3/6 | 31 |
| 指导 v2／标准 | 6/6 | 0/6 | 30 |
| 指导 v2／深入，旧 24K 上限 | 3/6 | 2/6 | 23，另有中断阶段用量未知 |
| 精简指导 v3／标准 | 6/6 | 5/6 | 21 |

深入组两项连续输出截断，一项进程中断。未知时长及用量保持未知，不记为零。深入组最初使用固定 24K 构建；不能把后来容量复测倒填进原成功率。v3 同时使用修正后的正文保护，因此不能把所有变化单独归因于提示词。

原截断场景的单次 48K 复测：日历 200 秒、40,488 completion token；器具对比 209 秒、36,746 completion token，均正常 stop 并通过结构校验。completion 包含 reasoning，报告另列 reasoning 数；不是最终 HTML 单独消耗这些 token。两例证明该容量修复有效，不能证明深入普遍优于标准。

证据：[原 18 项](acceptance/effort-comparison.json)、[容量复测](acceptance/effort-budget-replay.json)、[v3 六项](acceptance/effort-guidance-v3.json)。报告中的 complete 只表示固定样本有终态，不等于效果门槛通过。

## 风格结论与运行决定

v2 与 v3 均只有三组明确的任务相关结构／排版改善，未达到四组默认启用门槛。v3 中日历强化日期层级，文案增加检索／复制层级，随笔分开观察记录与正文；学术、器具、文档保持 neutral。多个页面仍偏好温暖浅色背景，不能宣称已解决全部风格趋同。

因此设计工作流继续由 `VIBROWSER_DESIGN_WORKFLOW=true` 显式开启，默认不启用。两挡、交互与保护修复正常保留。用户仍可选择深入，但本轮证据不支持推荐所有页面默认深入。未通过风格门槛不通过追加局部 prompt、挑选样本或改低判据掩盖。

截图及人工结论：[v2 对照](acceptance/effort-visual-review.json)、[v3 对照](acceptance/effort-guidance-v3-visual.json)、[v3 桌面与手机截图](screenshots/effort-guidance-v3)。

六个 v3 页面均进行了实际浏览器运行时回放：本地展开、筛选、排序、复制按页面存在的动作验证；搜索／链接提交被拦截，不冒充新页面生成链。学术页 Copy 目标为空，记为局部生成不足，不追加 prompt 或整页拒绝。详见 [回放](acceptance/effort-guidance-v3-interactions.json)。

## 真实同站连续浏览

从保留的日历动作分别调用真实 NavigateMessage，再执行生成工作流：下一日深入档 260 秒，上一日标准档 119 秒，均成功。页面分别显示 2026-11-08 与 2026-11-06，延续各自父页站名、配色和信息组织。下一日有非空已知实体且逐字继承；上一日动作没有绑定实体，不将空集合视作继承证明。

下一日品牌描述扩写导致字符串不相等，但页面站名未变化，人工检查单独记录；大号日期有换行不足，记录而不增加场景规则。两页的复制、展开、搜索／导航提交运行时回放通过。真实生成与隔离回放分开记录：[任务及用量](acceptance/effort-continuity.json)、[视觉核对](acceptance/effort-continuity-visual.json)、[运行时](acceptance/effort-continuity-interactions.json)。

## 当前运行与完成审计

服务已恢复 `http://127.0.0.1:5173/`，健康检查 `mock:false`；新会话默认 imagination／standard，正常临时页面清理策略恢复，设计实验开关关闭。[LIVE 首页截图](screenshots/effort-live.png)。

交互修复、评审误判修复、两挡持久化与隔离、容量复测、前后日真实连续浏览、自动化回归和运行恢复均有当前证据。设计指导已精简并完成固定对照，但“四组实质结构／排版改善”只观察到三组，目标二验收尚未通过；因此本轮整体目标仍保持进行中，不以功能测试全绿代替风格结果。

复验命令（真实样本回放不发模型请求）：

```powershell
.\scripts\check.ps1
cd frontend
node tools/review-effort.mjs --complete
node tools/review-effort.mjs --guidance-v3 --complete
node tools/review-continuity.mjs
# 旧格式 Mock 服务下；书签用例使用 v3 样例，在下一批运行
npx playwright test --grep-invert 'bookmarks persist'
# 默认 v3 Mock 服务下
$env:VIBROWSER_V3_MOCK_SMOKE='true'
npx playwright test tests/e2e/bookmarks.spec.ts tests/e2e/modes.spec.ts tests/e2e/research.spec.ts tests/e2e/research-ui.spec.ts tests/e2e/web-runtime.spec.ts tests/e2e/web-worker.spec.ts
```

固定真实运行器已有启动／结果标识，不能直接重跑覆写原样本。重新实验须有明确的新变更与独立结果位置；不为追求漂亮结果重复抽样。
