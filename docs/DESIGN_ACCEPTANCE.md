# 设计评审与两挡思考验收

产品批次第三题（2026-11-08）：日期页 194 秒成功，前两份分别因 typography／palette 对象类型被拒，第三份通过；可选评审在 60 秒超时后保留原稿，未回传该次 usage。前述通用元数据兼容无需继续修改，原第一份已离线通过完整校验与 Copy、Toggle、Filter、锚点、搜索／导航提交回放，零模型请求。[日期原响应](acceptance/style-metadata-replay-calendar.json)、[交互](acceptance/style-metadata-calendar-interactions.json)。原批次仍记录三次生成，不替换成离线成功。

当前产品批次仅完成 3/6，最终成功 3、首轮成功 1，14 次调用、550 秒；已记录 token 不是完整费用总数。三份最终页面的浏览器回放通过，后续器具对比、技术文档和随笔仍待结果。所有改进与失败保留，尚未宣布设计默认启用。

产品批次第二题与兼容修复（2026-11-08）：文案页 194 秒、5 次请求后成功；第一份响应仅因 `siteStyle.palette` 是对象而非字符串被拒，第二份通过，随后采用一次评审改进。新解码器仅将 typography／palette／layout 的对象或数组无损序列化为描述字符串；品牌身份、业务状态、HTML/CSS 和动作仍按原类型校验。没有新增 prompt，不根据配色名称或单个样本定规则。

37 项解码／文档／设计流程测试通过；原第一份响应离线解码、规范化、完整校验通过，HTML／CSS 未变、配色 JSON 可完整恢复；复制、锚点及搜索／导航提交浏览器回放通过，零模型请求。[离线记录](acceptance/style-metadata-replay.json)、[交互](acceptance/style-metadata-interactions.json)。原批次仍使用启动时构建，文案首轮失败保留，不改写为首轮成功。

产品批次已完成两题的最终页面交互回放，累计 9 次请求、356 秒；本次文案为左侧分类索引和右侧编号条目，黑红粗体标题与学术页的衬线研究路径有差别，但完整六题尚未结束，不提前判定视觉门槛。文案没有声明 Filter，本轮验证的是分类锚点而非实时筛选。[阶段报告](acceptance/effort-guidance-v8-product.json)。

产品 low／48k 批次进行中（2026-11-08）：已完成学术主页一题，首轮正文通过，最终采用一次改进，162 秒、4 次实际产品请求；保存输入／日期／资料与原基线一致。浏览器复制、原生锚点、导航提交回放通过；该页没有 Search，不因此要求补控件。截图仍是学术长文／研究路径，不把字体变化单独算成结构改善。当前仅 1/6，不能宣称批次完成。[阶段记录](acceptance/effort-guidance-v8-product.json)、[配对](acceptance/effort-guidance-v8-product-paired.json)、[交互](acceptance/effort-guidance-v8-product-interactions.json)。

认真模式的规划调用尚未由本批覆盖，因为六题复用了历史检索资料。已将规划 system/request 原样抽为 ResearchPlanPrompt，供产品和一次真实规划回放共用；17 项集成／检索客户端测试通过。ResearchPlanningAcceptance 需显式 VIBROWSER_PAID_PLANNING_ACCEPTANCE=true，仅在六题批次结束后运行，使用保存来源、实际产品参数和原 30 秒规划预算；不调用 Search/Fetch，不生成页面，不写数据库，不把它当作新联网检索验收。

low 同站连续性（2026-11-08）：通过保存的器具榜单实际动作进入 AeroPress Go 详情，159 秒、4 次模型请求，初次正文生成通过，采用一次改进；实体完整相等、品牌描述一致，未触发新站构想探索。桌面／窄屏截图延续父页暖底、衬线标题、橙色强调、细分隔线及正文与选购结论并排的编辑式结构，详情改变内容组织而非复制列表页。品牌字符串比较和截图判断分别记录，不以字段相等替代视觉验证。[任务与测量](acceptance/effort-guidance-v8-low-continuity.json)、[截图](screenshots/effort-guidance-v8-low-continuity)。

详情浏览器回放验证 Copy、Toggle、Filter、Sort、原生锚点和站内搜索／导航提交，零额外模型调用；未再生成下一层。[交互记录](acceptance/effort-guidance-v8-low-continuity-interactions.json)。另外 `npx playwright test tests/e2e/effort.spec.ts` 四项通过：两挡等待预算绑定提交快照、标签继承／历史与会话恢复、窄屏无整体横向溢出、兼容接口禁用深入。该测试使用拦截响应，不是四次真实模型验收。

本轮没有新增 prompt 或改变默认参数。产品标准 disabled／24000、深入 high／48000；low 及容量复测仍是验收配置。官方思考参数已核对 [DeepSeek 文档](https://api-docs.deepseek.com/guides/thinking_mode/)，文档确认 low/high/max 可用，不代表质量门槛已通过。

low 固定六题完整记录（2026-11-08）：最终 5/6，首轮 4/6，共 23 次模型请求，累计任务耗时 1395 秒。两次可选评审超时的 usage 未返回，因此 422996 total_tokens 仅是已记录量，不是完整费用统计。原技术文档题四次生成均以 length 结束，每次 completion_tokens=24000，推理占 14555、16051、22976、16639；失败保留，不将后续复测覆盖为成功。[完整记录](acceptance/effort-guidance-v8-low.json)、[原输入配对](acceptance/effort-guidance-v8-low-paired.json)。

五份成功文档的浏览器离线回放通过：每页实际声明的 Copy、Toggle、Filter、Sort、锚点和搜索／导航提交按报告分别验证，零额外模型请求；不是每页都有全部动作，也未生成搜索或详情结果。[逐页交互](acceptance/effort-guidance-v8-low-interactions.json)。相关 Scala 定向测试 23 项通过；没有据此宣称全量发布验收完成。

桌面截图对照：文案由平铺列表变为副刊主文与热门索引；日期由日期概览及节日列表变为日期索引与词条正文；器具对比由场景切换和表格变为编辑榜单及并列决策指南；随笔由窄栏长文变为主文、地点索引与归档。四组存在任务相关结构变化，但整体仍频繁采用暖底色、衬线标题和细分隔线，不据此声称跨站视觉趋同已经解决。技术文档生成失败，且本批同站连续浏览尚未验证，默认启用条件仍未通过。[截图](screenshots/effort-guidance-v8-low)。

容量排查为单独一次文档请求：复用失败任务的原始输入、设计说明和资料，不重新规划或评审，不写回数据库；仅验收请求启用 48000 token 容量和 600 秒请求时限（原生成 24000／180 秒）。因此这是容量与等待预算复测，不是严格单变量实验；不改变 prompt、增加修复次数或重抽六题。生产档位与实验默认开关未改变。

该容量请求一次成功：127 秒，finish_reason=stop，completion_tokens=24672（reasoning_tokens=16398），total_tokens=35232；没有用到扩大的等待时限，实际输出超过原 24000 限制。支持输出容量不足的判断，不证明每次长文都能成功。桌面／窄屏测量和浏览器 Copy、Toggle、原生锚点、搜索提交回放通过，零额外模型调用。页面采用深色技术导航、步骤总览及并列解释／代码区；此为单独修复验证，不计入原六题的成功率或视觉分数。[容量报告](acceptance/effort-low-capacity.json)、[交互报告](acceptance/effort-low-capacity-interactions.json)、[截图](screenshots/effort-low-capacity)。

low 思考阶段记录（2026-11-08，仅前两题，非完整验收）：学术、文案均首轮生成成功，实际三阶段请求均为 enabled/low、24000 token 上限。两次可选评审都在原 60 秒预算超时后保留原稿，无法得知这些未返回请求的 usage；报表现从实际调用记录判断用量是否完整，不将缺失视为零或完整。记录到的 61296 total_tokens 只是已返回调用的合计。

两页运行时回放通过；文案的 Copy、Filter、Sort、展开、锚点和搜索提交均验证，搜索不算后续真实生成。第一次 Sort 断言失败是 Windows Node 默认中文排序与 Chromium en-US 排序不一致，现用浏览器 Intl.Collator 计算期望并记录 sortLocale，未更改运行时或生成内容。格式、类型检查及修正后的回放通过。证据：[阶段调用报告](acceptance/effort-guidance-v8-low.json)、[配对参数](acceptance/effort-guidance-v8-low-paired.json)、[两页回放](acceptance/effort-guidance-v8-low-partial-interactions.json)。余下四题仍在原进程运行，暂不作整体风格或默认档位结论。

v9 阶段归因（2026-11-08）：保存响应离线重放了 16 个视觉阶段。先用现有 Normalize/Validate 构造仅用于布局核对的页面，移除实体／状态绑定，表单赋予审计占位动作；全部通过原资源与结构校验后才进入离线浏览器，未点击或调用模型。这不是交互验收，也没有修改真实记录。六个原始草稿都可用于视觉查看，其中学术草稿缺失 siteStyle，因此原工作流未采用它。

日历、器具对比、文档、随笔的草稿与最终页保留相同正文背景与首个标题字体栈；草稿已使用浅底、无衬线标题、简介／概览区。文案草稿有明显红色首屏，但不能把配色变化单独算作排版改善。器具容器损失已由上一项 CSS 修复解释；学术最终页的字体变化发生于草稿失败后的独立生成，不是评审所致。证据：[阶段尺寸／结构／字体](acceptance/design-stages-v9.json)、[校验后草稿截图](screenshots/design-stages-v9)。结论是继续增加评审规则缺乏依据；先检查创作阶段参数，而不是逐页补 prompt。

v9 固定六题已结束（2026-11-08）：原构建最终 5/6、首轮 3/6，26 次请求，累计 788 秒，686847 total_tokens；没有重复抽样。学术题草稿缺少 siteStyle 后回退原生成；文案题被重复正文检查误拒；其余四题保留了草稿。文档采用评审改进，其他成功页保留原稿。五份成功文档的浏览器回放通过；对比页 Copy 目标为空，不能记作有效复制。导航／搜索仅验证提交，不代表后续真实生成。证据：[完整调用记录](acceptance/effort-guidance-v9.json)、[回放](acceptance/effort-guidance-v9-interactions.json)、[截图](screenshots/effort-guidance-v9)。

桌面和窄屏首屏对照仍多为大标题、简介、统计／卡片和后续正文；不能确认四组实质排版改善。文案原始失败也不满足功能无退步条件。设计实验继续默认关闭；没有因可选控件或轻微审美不足追加提示词，也不将离线修复结果改写为本批真实成功。

另发现宿主 CSS 解析器会把合法 `min(1120px,100% - 2.5rem)` 所在容器规则读成空规则。8.2.3 试验仍失败，已撤销依赖升级。现用已有解析器的 lexer 识别 min/max/clamp 中直接算术参数，补等价 calc 包装，再走原完整解析和资源校验；没有正则解析整份 CSS、没有限制模型布局。该数学语法依据 [CSS Values 4](https://www.w3.org/TR/css-values-4/#comp-func)。

127 项 Scala、42 项前端、格式／类型／构建通过；回归包含注释、字符串、CRLF／制表符、嵌套函数、变量及外部资源拒绝。保存的对比页原响应离线重新校验成功，桌面容器从贴边的 1425px 恢复为居中的 1120px，窄屏左边距恢复为约 12.8px；没有模型调用，不改原缓存。证据：[校验](acceptance/design-draft-replay-comparison.json)、[浏览器尺寸](acceptance/css-math-replay-layout.json)、[前后截图](screenshots/css-math-replay)。这修复布局损失，不单独计为模型风格多样性提升。

v9 中途修复（2026-11-08）：文案页草稿为每条内容同时生成可见段落和隐藏复制副本，装配后显示与 Copy 共用可见节点。原正文覆盖检查按重复次数计数，将合理去重误判为正文丢失，四次响应均被拒绝。草稿装配现在检查内容覆盖、不要求保留重复副本；已采用页面的评审仍保留原重复计数保护，删除不同正文仍拒绝。未添加 prompt 规则。

30 项定向 Scala 测试通过。保存的四次原始响应离线重新执行解码、规范化、完整文档校验及草稿正文检查，4/4 通过；首份响应的浏览器复制、筛选、排序、原生锚点和搜索提交回放通过，零模型调用。搜索仅验证提交，没有新生成结果。回放的 Copy 比较当前显示文本与剪贴板；因为原批次没有 Accepted 响应，旧回放工具的原始采用稿比较为 null，不能声称该项通过。证据：[离线校验](acceptance/design-draft-replay.json)、[交互回放](acceptance/design-draft-replay-interactions.json)。原批次的失败记录未改写，仍按原构建继续余下固定题目；完整视觉结论待批次结束。

v9 实现检查（2026-11-08）：新增视觉草稿→实体与动作装配实验，替换原文字规划，不增加评审轮次。29 项定向测试、Scala 124 项全量测试及格式／编译、前端 42 项与格式／类型／生产构建通过。草稿快照和旧任务恢复、同站身份、预算与正文丢失、一次失败回退均已验证。CSS 比较以现有解析器规范化结果为准。未改变生产默认，尚无 v9 真实视觉结论；下面的 v8 结果不作为 v9 的通过证据。

深入档固定六题已全部完成（2026-11-08），无重复提交：最终 6/6，首轮结构通过 6/6，23 次请求、累计任务耗时 1609 秒、记录 total_tokens 691691，其中 reasoning_tokens 210497。标准档对应为最终 6/6、首轮 5/6、21 次请求、314 秒、273805 total_tokens。两挡同时包含已实现的思考设置与输出预算差异；这是一批固定样本，不证明深入普遍更准确或更优。

[标准／深入配对报告](acceptance/effort-guidance-v8-paired.json)及 `frontend/tools/compare-effort-v8.mjs --complete` 已核验六对的原请求、日期、来源、指导版本一致，以及每次调用的 thinking、reasoning_effort、max_tokens 与无采样变更。档位作用于整个流水线，规划结果和后续视觉参照也会变化，因此不宣称是仅生成阶段的因果实验。

文案的 Copy、Toggle、Filter、Sort 和原生锚点均通过实际浏览器回放，排序比标准档该题完整。日历以冷灰色信息面板与日期流组织内容，标题与今日条目均为原固定请求中的 11 月 7 日。器具对比页修复了 CSS 页面容器未绑定的问题：390 视口下 scrollWidth 由 391 降为 375，verdict 越界消失；展开、复制、筛选、排序和锚点均通过。搜索／跨页导航只验证拦截提交，不算真实后续生成。修复功能不计作风格改善；普通审美不足只记录，不新增 prompt 规则。

深入档视觉对照为文案、日历、文档、随笔四组改善，学术与器具对比 neutral。标准档仍只有两组，不能用深入结果替换标准档默认启用门槛；设计实验保持默认关闭，整体目标继续进行中。尚未进行 v8 的真实同站详情验收。

技术文档最终搜索框两种视口均为 44px；点击第二章后，桌面标题顶部为 89px，位于导航底部（51px）下方，窄屏也可见。随笔复制初次回放误把初稿当作比较基准：初稿列表无换行，改进原始输出与最终输出包含换行，非正文丢失。回放已按实际采用的生成／改进原始输出比较，完整剪贴板断言不变，六页复测通过；没有改动生产校验或新增 prompt。

证据：[完整深入调用报告](acceptance/effort-guidance-v8-deep.json)、[六题交互](acceptance/effort-guidance-v8-deep-interactions.json)、[视觉结论](acceptance/effort-guidance-v8-deep-visual.json)、[文档布局复验](acceptance/effort-guidance-v8-deep-docs-layout.json)、[截图](screenshots/effort-guidance-v8-deep)。此前 partial 交互文件保留为阶段证据，不代表完整覆盖。最终报告与配对检查通过，回放测试格式及类型检查通过；本阶段未重复全量 Scala／Mock 浏览器测试，生产代码未改变。

v8 标准档渲染追踪已完成：[离线字体与原稿核对](acceptance/design-render-audit-v8.json)。六题最终 HTML/CSS 与候选完全相同，故该批视觉趋同不能归因于评审改写。h1 与首个 p 使用宋体／微软雅黑变体，并非全局单一字体覆盖；探针范围不代表整页字体。构想已体现在便签、月历、风险侧栏等结构中，效果不足仍如实保留。深入档隔离验收运行器已编译及格式检查通过，标准报告重新生成校验通过。

最新 v8 结果（2026-11-08）：固定原六题和检索资料，模型在原规划请求中提出三个内容相关构想，宿主按地址稳定选择。六题最终 6/6、首轮 5/6，21 次模型请求、累计任务耗时 314 秒；没有重抽样。桌面／窄屏比较只有文案便签墙和月历网格两组明确结构改善，其余四组 neutral，未达到四组门槛，实验保持默认关闭。日历今日高亮不一致、文案排序选项与契约不符单独记录；不为微小不足继续追加 prompt。

本轮 Scala 格式／编译及 118 项测试通过，前端格式／42 项单测／类型／生产构建通过，Chromium 测量 4 项通过。真实输出通过隔离浏览器回放，导航／搜索提交由拦截器验证，不算后续模型生成成功；复制、筛选及页面内锚点按存在的控件验证。未重复全量 Mock 浏览器套件，也未开展 v8 同站付费验收。LIVE 健康检查为 `mock:false`，本轮未改变其运行模式。

证据：[任务、调用与构想](acceptance/effort-guidance-v8.json)、[六题视觉结论](acceptance/effort-guidance-v8-visual.json)、[运行时回放及限制](acceptance/effort-guidance-v8-interactions.json)、[截图](screenshots/effort-guidance-v8)。此前各版记录保留如下，不能以本轮结构通过替代风格门槛。

v7 进度（2026-11-08）：已将完整规划简报改为内容重点投影，生成／评审／改进不再接收规划中的版面顺序及额外交互清单。21 项针对性回归及完整 109 项 Scala、42 项前端检查通过；固定六题真实对照已完成：最终成功 6/6、首轮 2/6，结构／排版改善 2/6，未达到默认开启门槛。设计实验继续默认关闭。以下保留此前版本记录。

最新状态：交互修复与标准／深入两挡已实现。v3、v4、v5 对照均已完成，但未达到四组结构／排版改善门槛。v6 动态视觉参照已实现，固定六题真实对照已完成：最终成功 6/6，视觉改善 3/6，仍不默认启用。当前完整检查为 Scala 108 项、前端 42 项及格式／类型／构建通过，另有 4 项 Chromium 测量测试。下文历史结果保留各次实验原含义，不用后续结果覆盖。

v4 的依据是[渲染审计](acceptance/design-render-audit.json)：六页中五页 CSS 未被评审改变，实际系统字体不同，未发现宿主统一覆盖。实验移除规划阶段的早期视觉规格和完整交互契约，让页面生成阶段结合内容直接决定字体、颜色与布局；既有站点 siteStyle 仍随导航上下文传递。报告新增简报长度、早期视觉字段长度及评审是否改动 CSS，用于区分阶段影响，而非作为审美评分。LIVE 保持设计实验默认关闭。

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

两挡交付时的基础检查为 Scala 格式与 101 项测试通过；前端格式、42 项单测、类型／生产构建通过。最新运行时与档位浏览器定向 8 项通过。最终旧格式 Mock 回归 36 项通过、2 个 v3 专用用例跳过；随后 v3 Mock 11 项全通过，包含跳过的用例及 v3 书签。两批合起来覆盖当前 39 个浏览器用例，重复执行的用例不计作独立覆盖。详见[浏览器结果](acceptance/effort-browser-regression.json)。

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

## 2026-11-08：v4 固定对照与修复边界

遵循用户最新要求：轻微交互不足、排版不精致和可选增强作为观察项，不逐项加入 prompt，也不触发整页重做。现有简短评审已表达这一边界，本次不再增加规则。优先修复宿主造成的数据丢失、主要操作失效和协议错误。

v4 将内容规划与视觉设计分离。固定六题均有终态，6/6 ready、首轮结构通过 1/6、29 次模型请求、合计 662 秒。其首轮通过率低于 v3 的 5/6；不能只用最终成功率说明稳定性提高。六页运行时回放通过，但复制回放另查原始正文后发现一个真实数据丢失问题，不能将 API 成功等同于内容正确。

桌面逐题与旧标准比较，并检查手机截图：学术、随笔有明确结构改善；文案、日历、器具、文档为 neutral。增加首屏介绍、卡片或字号不自动算改善，部分新页把核心内容推远。当前只有两组明确改善，未达到四组默认启用门槛，继续保留实验开关；不为通过门槛堆提示词或重抽样。v4 未另做真实父子页复测，前一版本的连续浏览证据仍单独保留。

文案页问题来自宿主 Summary 字段覆盖完整正文，已添加替换前的通用冲突校验。用原 Accepted 响应进行一次真实修复请求，29 秒、8/8 原段落完整保留；原样本和数据库页面未覆盖。浏览器回放验证复制原文、筛选和搜索提交，额外模型调用为零。随笔的复制变化是将“标签＋句子”收窄为按钮承诺的开头一句，属于合理修订，不按数据丢失处理。

证据：[v4 用量](acceptance/effort-guidance-v4.json)、[视觉判断](acceptance/effort-guidance-v4-visual.json)、[运行时回放](acceptance/effort-guidance-v4-interactions.json)、[单次正文修复](acceptance/summary-binding-repair.json)、[修复后交互](acceptance/summary-binding-interactions.json)。Scala 当前 104 项通过，前端格式检查通过；整体风格目标仍未完成，不用增加个别样本规则掩盖。

当前 Summary 保护构建的 v3 Mock 浏览器回归再次通过 11/11，覆盖书签、模式、检索、三类运行时、连续搜索与局部任务；无真实模型请求。已恢复 LIVE，设计实验默认关闭。

### 动作契约去重（2026-11-08）

检查实际请求发现，设计流程的生成与改进阶段同时在 system 和 user 消息中附带整段动作契约。现仅在 system 提供一次完整协议及已有能力限制；user 消息保留当前需求、上下文、简报或待修正页面。评审仍独立收到动作契约，默认非实验生成不改变。没有新增交互细则、风格约束或模板。

新增 PostgreSQL 流程测试实际截获生成、格式修复、评审后改进的请求，验证 Copy 契约只出现一次、能力限制与来源上下文仍保留，调用次数不增加。DesignWorkflowSuite 12 项、DesignPreservationSuite 5 项通过，Scala 编译及格式完成。此项只证明去除重复提示且协议未丢失，未发起新付费样本，不宣称风格门槛通过。运行中的 LIVE 默认未开启实验流程。

## v5 固定实验与测量上下文（2026-11-08）

固定六题 6/6 ready，首轮结构接受 3/6，27 次请求，合计 533 秒。学术、文案和日历有任务相关结构改善；器具、文档、随笔仍为 neutral。手机截图与六页浏览器回放均已检查，未达到四组默认启用门槛，实验保持 opt-in。与旧标准比较的具体取舍见 [视觉记录](acceptance/effort-guidance-v5-visual.json)，不把更多介绍区当成更好的布局。[用量与任务](acceptance/effort-guidance-v5.json)、[交互回放](acceptance/effort-guidance-v5-interactions.json)。

回放首次失败是文案页的 #top 被测试当成跨页导航，等待本不应出现的接口错误。修正测试后，直接确认回到目标区域且零 API 请求；六页通过。原失败保存在 effort-guidance-v5-replay-initial.json，未重生成页面、未修改生成内容。Copy 的原始正文对照为 null 时表示该项未证明，不等同于正文丢失或完全一致。

此外，学术页评审曾将横向滚动导航的屏外控件当成布局问题。测量原本已排除这类元素的 overflowIds，但单个控件坐标缺少滚动容器上下文。新增独立 LayoutScrollContext，携带容器 ID、可见宽度、滚动宽度和左右边界；LayoutElement 的可选字段兼容旧报告。只补真实测量数据，不新增 prompt 规则，不禁止横向导航，也不自动丢弃评审。该数据能否减少模型误判尚未以真实评审复测证明。

三项 Chromium 测量测试通过：普通页面溢出仍能检测，横向滚动项带容器信息，三套运行时 fixtures 不提交请求。Scala 流程、正文保护及历史测量编解码共 18 项通过。测量程序在 v5 批次结束后才构建替换，固定六题沿用原测量条件，未混用新报告。此次没有再发起同站生成，旧版连续浏览证据保持单列。

## v6 固定对照与筛选修复（2026-11-08）

[真实生成报告](acceptance/effort-guidance-v6.json)：六题最终均成功，首轮成功 1/6，28 次模型请求，任务耗时合计约 515 秒。动态视觉参照不增加模型调用阶段，但此次结果尚不能证明其提升了多样性；学术与文案两页生成时没有历史参照。

[视觉结论](acceptance/effort-guidance-v6-visual.json)：学术、文案、文档三组改善；日历、器具对比、随笔中性。桌面与手机截图保存在 `screenshots/effort-guidance-v6/`。未达到四组门槛，设计实验继续默认关闭；本版本同站真实连续性已补测，见下方记录。

[首次交互回放](acceptance/effort-guidance-v6-interactions-initial.json) 保留文档筛选失败。原因是筛选区域包含控件和嵌套列表，运行时按直接子节点过滤时隐藏了输入框。修复优先选择带声明字段的条目，保留筛选控件，兼容没有字段的直接子条目。未修改生成 prompt，也未重新生成样本。

[修复后六题回放](acceptance/effort-guidance-v6-interactions.json) 无执行错误；四项运行时浏览器测试、42 项前端单测、格式、类型与构建通过。日历 `copyContentPreserved=false` 是初稿与改进稿文本措辞变化，已核对并非宿主丢失正文；不以这个差异触发额外修复。复制行为仍严格核对当前可见原文。

轻微排版与次要交互缺口只记录；不为每个样本扩充 prompt。尚未完成的目标是跨主题风格改善门槛及最终整体验收，不能把此次六页成功生成视为整个目标完成。

## v6 同站详情与规划审计

从已保存器具对比页进入 `/tool/slim-dripper`，真实任务 `c46e7c51-2603-48fa-8d0e-17d2f872c83c` 成功，57 秒、4 次模型请求。已知实体完整继承，品牌描述一致，任务的其他站点视觉参照为空。桌面与窄屏检查确认原站配色、字体和内容宽度延续；详情改用单品结构。见[详情报告](acceptance/effort-guidance-v6-continuity.json)及[交互回放](acceptance/effort-guidance-v6-continuity-interactions.json)，回放验证搜索和导航提交，不额外调用模型。

[实际规划审计](acceptance/effort-guidance-v6-planning-audit.json)发现，简报仍在 `informationStructure` 中预排首屏、列表和页脚，文案题还自行增加免责声明与分享要求。未在当前 v3 生成路径找到强制米色默认值或采样温度覆盖。这是规划约束可能造成趋同的证据，不是因果结论。下一轮应对照减少生成输入中的重复规划材料，保留原始请求、资料和同站上下文；不继续添加逐样本提示规则。

## v7 减少规划约束的固定对照

[生成报告](acceptance/effort-guidance-v7.json)：原六题和检索资料不变，最终 6/6 ready、首轮 2/6、24 次模型调用、合计 449 秒。所有样本的 contentFocusOnly=true。独立 schema effort_guidance_v7 保留模型原始响应与诊断；没有抽样重跑。

[视觉结果](acceptance/effort-guidance-v7-visual.json)：学术与文案两组实质改善，其余中性。学术与文档出现冷色分区，但颜色变化不计入结构改善；比较页、随笔仍将较大的介绍置于主要内容之前，文档手机端的概览卡也推迟了查阅内容。删除规划中的版面顺序并未达到四组门槛，设计实验继续默认关闭。没有追加逐样本规则，没有将 v6 的连续性结果冒充 v7 验收。

[六页交互回放](acceptance/effort-guidance-v7-interactions.json)全部完成，未调用模型。完整 Scala 109 项、前端 42 项、格式／类型／构建通过。一次在 LIVE 下误启动的完整 E2E 被 Mock 环境前置检查阻止，随即停止；后续使用独立 Mock schema 分别回归 v3 与旧格式。

本轮最终浏览器组合：默认 v3 Mock 11 项通过；旧格式 Mock 36 项通过、2 项 v3 用例跳过（已由前一批覆盖）。加载几何稳定、迟到响应、标签关闭、两挡提交快照、模式与设置草稿、实体导航、书签及缓存均有当前回归。服务恢复 LIVE，健康检查 mock:false，设计实验和测试临时保留开关均关闭。新增截图仅保留本轮真实 v7 对照，常规 Mock 运行覆写的历史截图已恢复。

## 独立复制反馈默认值（2026-11-08）

采样实验中的文案页失败包含复制反馈键已声明但 initialState 缺少初始值。解码器现在仅给未持久化、未与其他动作共享的 Copy 反馈键补空字符串；不更改已有状态、正文、动作或业务状态。13 项解码／绑定测试通过，含重复解码不变、与显式及隐式动作状态冲突时不填充。未增加 prompt。

原失败输出离线复验仍未整页通过：反馈缺项消除后，下一错误是 act-submit 缺少 region。见 acceptance/copy-feedback-replay.json；不猜测提交目标，不把此修复称作真实样本成功。原采样运行使用启动时固定构建，原失败记录保留，离线复验额外模型调用为零。

## 标准档采样实验：不采用更高温度

固定六题 temperature=1.3 对照最终 3/6 ready、首轮 1/6、31 次模型调用、合计 726 秒。v7 默认采样此前为 6/6、首轮 2/6、24 次调用。此为小样本对照，不据此推断所有输入，但不足以采用新参数。生产采样默认保持不变。详细任务、参数与失败见 acceptance/effort-sampling-v1.json，三个成功页面的交互回放见 effort-sampling-v1-interactions.json；其余三题没有可回放页面，不能计为通过。

随笔原始响应使用安全的 figure / figcaption 及引用元数据 cite，但被宿主白名单拒绝。现支持这些语义标记，不增加网络资源或脚本能力，7 项文档协议测试通过。离线复验经过实际 Normalize 与 Validate 阶段，仍因未绑定动作表单的 action/method 属性失败，见 acceptance/text-figure-replay.json；没有继续猜测动作或修改原页面。未追加 prompt，原失败记录保留。
