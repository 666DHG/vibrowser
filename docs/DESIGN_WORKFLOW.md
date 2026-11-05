# 内容驱动设计实验

2026-11-05，分支 `feat/content-driven-design`，基线 `865f77f`。新页面依据内容和访问者任务设计，不新增模板目录、布局枚举或网站类别到组件的映射。

## 实现

项目 skill 位于 `.agents/skills/vibrowser-web-design`。设计与评审指导由 sbt 从同一份 UTF-8 Markdown 打包到 classpath，版本包括内容 SHA-256；上游参考、核验日期及许可证记录在 skill 的 sources.md，没有复制模板或资源。

完整页面流程为：检索（认真模式）→ DesignBrief → 原有生成与严格结构校验 → 保存候选 → Chromium 实测 → 文本模型评审 → 至多一次改进 → 校验、测量和选择。模型依据 HTML/CSS、实体、动作、设计说明和布局报告工作，不接收截图。截图用于人工验收。

- 原有结构生成最多 4 次、每次 180 秒；简报与评审各 1 次、各 60 秒；改进 1 次、180 秒。最多 7 次模型请求，检索预算保持原状；前端等待上限 30 分钟。
- 两个视口为 1440×900、390×844。测量使用正式 iframe 运行时，屏蔽网络，不点击提交或触发模型。独立滚动容器和隐藏内容不算整页溢出。
- 有效候选先写入 `generation_jobs.design_workflow` JSONB。可选阶段失败回退候选，鉴权/额度错误在简报阶段直接停止。改进不得丢失实体、字段绑定、动作、主体、初始状态或主要正文，不接受新增整页溢出；测量不可用时不采用改进。
- 重试复制已保存工作流；成功候选、已开始的可选付费阶段不重复执行。中断时仍标为 Started 的可选阶段跳过，不冒充完成。数据库与模型调用分离，保存检查 current_job_id 与 running 状态。
- 新阶段在既有进度面板展示，旧页保留。局部更新跳过整页设计，站内搜索生成完整页面时参与。v1/v2 与既有 v3 书签不改写。
- 数据对象独立 final case class 与伴生 codec；阶段、状态与选用结果采用封闭 enum。内部 SaveDesignWorkflowMessage 保留 plan(connection): IO，SQL 归属 GenerationJobTable/Initializer，没有转发 Service。

## 启动与复现

实验默认关闭；通过开关在此分支试用，未达到对照门槛前不替换正常默认路径：

```powershell
$env:VIBROWSER_DESIGN_WORKFLOW = 'true'
.\scripts\start.ps1
# 回到旧流程：停止后将该变量设为 'false' 再启动
```

启动脚本构建 `frontend/dist-measure` 并安装 Chromium 到 `.cache/playwright`。服务运行目录仍为 backend。Chromium 不可用会记录测量失败并使用有效原页。

```powershell
.\scripts\sbt.ps1 scalafmtCheckAll test
cd frontend
npm run format:check
npm test
npm run build
node --test tools/measure.test.mjs
```

浏览器旧格式回归使用 `VIBROWSER_LEGACY_MOCK=true` 启动 Mock，再执行 test:e2e（33 项）；v3 Mock 使用默认启动，设置 `VIBROWSER_V3_MOCK_SMOKE=true`，运行 research.spec.ts 与 web-worker.spec.ts（2 项）。两类固定样例不可混用，否则旧测试会找不到 v1 的固定标题。

付费对照只在显式 opt-in 下运行：

```powershell
$env:VIBROWSER_PAID_DESIGN_ACCEPTANCE = 'true'
.\scripts\sbt.ps1 'Test/runMain services.generation.DesignAcceptance'
cd frontend
node tools/review-design.mjs
```

验收程序从 LIVE 读取 DPAPI 凭据，不打印或复制密钥；任务写入独立 `design_acceptance` schema，使用真实接口，非 Mock。每对成功检索共用同一份快照；原始输出在忽略目录 `.cache/design-acceptance`，报告仅保留非敏感摘要。已有结果不重跑。`VIBROWSER_DESIGN_ACCEPTANCE_RETRY=academic` 只允许该失败场景重试一次，首轮失败另存，成功样本不会因此重跑。

## 验收记录

自动检查：90 项 Scala 测试（含 6 项新增设计工作流测试）、42 项前端单测、2 项真实 Chromium 测量测试、35 项分模式浏览器回归通过。覆盖候选保存、可选阶段错误/超时、请求上限、重试复用、旧代次拒写、迁移重复执行、部分更新绕过、站内搜索参与及进度显示。格式、类型检查和生产构建通过。

真实记录和截图见 [对照数据](screenshots/design-workflow/results.json)。最终判定在下方补充，不能将结构通过或采用 Improved 等同于人工判定更好。

已发现并修复：首轮器具对比页出现不支持的数值范围筛选承诺。设计说明原先只知道自由布局要求，没有拿到准确动作能力；现已在简报、生成和评审中共享运行契约，明确文本匹配、独立筛选与 Set 的实际语义，评审优先检查可见控件承诺。首轮该样本保留为问题，不记作成功改善。

### 最终结果

首轮任务成功 10/12；学术主页旧/新各一次 20 秒检索超时，未消耗页面生成请求。保留失败后，各重试一次，最终六对页面均有有效结果（12/12）。检索失败时没有回退幻觉模式。三个认真模式主题的新旧页面分别复用同一份成功检索快照。

下表请求数为“结构生成＋设计阶段”，不包含检索规划/Search/Fetch；耗时含本任务实际执行的检索。完整 ID、阶段错误、检索来源与请求数见 results.json。

| 固定主题 | 旧流程秒/请求 | 新流程秒/请求 | 实际观察 |
| --- | --- | --- | --- |
| 清华教师袁洋主页 | 71 / 2+0 | 62 / 2+2 | 重试后成功；新页以窄栏正文、研究纲领和工作条目组织，旧页为简介＋概况侧栏。评审返回无问题，未强制改进。 |
| 深夜电台听众社区 | 45 / 2+0 | 115 / 2+3 | 新页以当前节目和讨论入口组织；测量发现原候选仅有容器 CSS，改进补齐字号、配色及分栏。 |
| 便携手冲器具对比 | 34 / 2+0 | 134 / 2+3 | 数据与条件入口更丰富，但重量/价格 radio 只改变选中状态，不能执行页面承诺的即时范围筛选；不算改善通过。 |
| PostgreSQL 学习笔记 | 51 / 1+0 | 93 / 1+3 | 从章节卡片改为连续阅读与速查表；改进因正文覆盖不足被拒，使用原候选。另发现复制与勾选计数的声明超出 Set 实际能力，须继续治理。 |
| 嫦娥六号新闻专题 | 64 / 2+0 | 71 / 1+3 | 从报道列表转为任务时间线＋连续专题，信息结构有变化；不能只以换色计为改善。 |
| 沿海小城散步随笔 | 86 / 2+0 | 139 / 3+3 | 新页将散文阅读放在首屏，宋体、窄行宽和段落组织明显区别于社区、新闻及选购页。 |

12 个最终页面在两个视口测量均未发现整页横向溢出；局部表格继续可横向滚动。人工检查桌面和窄屏截图。**实验尚未达到“至少四组明显改善、其余不退步”的完整发布门槛**：功能承诺问题不能由结构校验或单次模型自评完全发现，因此不默认开启，也未合并主分支。能力约束提示已加强，尚未重跑所有成功样本来宣称问题消失。

额外真实连续浏览：从社区的绑定帖子链接生成详情，任务 `ed32c88d-d931-48a9-9ea1-9ea136dcb4dc`，页面 `ab9392e4-96f9-47ec-b77f-a9cbd5d401cf`，80 秒，1 次结构生成＋3 次设计请求；所点击实体字段与品牌精确保留。记录为 discussion-detail。

六个新页面另通过浏览器运行时回放：学术与选购页面展开正常；其余五页的 Search 发送正确 actionId 与查询值，失败时保留输入。回放拦截网络提交，**这部分不是额外真实搜索/生成成功**，模型调用为零。见 interaction-replay.json。测试最初复用页面导致会话恢复竞态，已改为每个样本使用独立浏览器 context。

最终恢复 LIVE，当前测试实例显式启用 `VIBROWSER_DESIGN_WORKFLOW=true`，方便在本分支试用；代码默认仍关闭，既有书签与未收藏会话样本没有被本轮清理。下一步优先补上“页面承诺—动作能力”的检查与相关真实复测，而非增加人工模板。