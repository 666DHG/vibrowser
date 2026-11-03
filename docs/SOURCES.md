# 规划依据与核验记录

整理日期：2026-11-03。

## 原始对话

[Vibe Browser方案](chatgpt-conversation://6ae9b79c-1078-83ea-8bcf-216a24897bcf)，已读取全部三轮及随附的 `tokenhub_student_quickstart.txt`。未将完整聊天、临时附件路径或凭据复制进仓库。

用户明确表达：三天开发窗口；期中作品；从原游戏方向转为 Vibe Browser；实时生成网页和不存在的本地文件；持有 DeepSeek 与腾讯 API；需要梳理前端交互与后端 AI 的架构。

原对话建议：React/TypeScript、Scala 3/Cats Effect/http4s、PostgreSQL；PageSpec 优先；声明式 Action；缓存与网站设定；有限校验修复；图片异步；不开发通用 Agent。后续已查阅本地课程规范与讲义，对代码结构作出修订；尚未取得独立期中评分细则，不宣称已覆盖全部评分项。

本次工程取舍：默认 Vibe 模式，不自动探测真实网址；真实网页显式外部打开；核心 P0 优先于搜索和生图；浏览器历史暂存 localStorage；补充任务去重、重启恢复、跨端契约样例和验收矩阵。它们是当前开发建议，并非原对话中用户逐项确认的要求。

## 本轮用户修订与课程依据

用户进一步要求：不按 Day 分工，细化 roadmap，重点关注课程代码规范与类的实现。因此路线改为依赖阶段 S0–S7，每阶段列出类、职责、具体工作和退出条件。

已读取 `D:/Vault/大二秋/无代码/rules.txt`（1–60 条），课程笔记总览及相关专题，并核对 lec3/lec4 的对象、函数式与逻辑微服务原文。抽查 `sample.zip` 中 APIMessage.scala、GetBookAPIMessage.scala、BookTable.scala、APIMessageRouter.scala；没有运行或整体复制示例工程。

据此将通用 service/infrastructure 分层替换为 services 下的 api/objects/routes/tables/utils；采用 final case class、伴生编解码、独立 Message.plan(connection)、封装 Table 和对应前端 API 类。统一消息路由替代旧 REST 草案。具体规则编号、原文链接和模板差异见 [COURSE_STANDARDS.md](COURSE_STANDARDS.md)。

rules.txt 是本地工程规范来源，讲义是课程理念来源；示例工程只是参考。对模板差异的处理和后台任务的短事务设计属于本项目工程决策，不冒充老师逐条作出的要求。

## API 资料

| 来源 | 本次核验结果 | 仍待实测 |
| --- | --- | --- |
| 对话附件：TokenHub 学生 API 使用速查 | 广州地址 `https://tokenhub.tencentmaas.com/v1`，文本模型 `deepseek-v4.1-flash`；列出全景图能力，未列出常规 WAND/Kling 文生图授权 | 当前 Key 权限、额度、耗时和真实响应 |
| [腾讯官方模型列表](https://cloud.tencent.com/document/product/1823/130051) | 官方列表包含 `deepseek-v4.1-flash`；对话模型名称有公开依据 | 具体账户能否调用 |
| [腾讯 API 使用说明](https://cloud.tencent.com/document/product/1823/130078) | 广州接入域名、Bearer 鉴权和 `GET /v1/models` 查询方式有官方说明；地域配置需要对应 | 当前 Key 的模型列表与最小生成请求 |
| [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/) | `response_format: {type: json_object}`，Prompt 需明确 JSON；须处理空白与截断输出 | TokenHub 的对应模型参数兼容性与 Schema 合格率 |

Smoke 实施已完成自动化与 Mock 验证，**没有调用收费模型 API，也没有验证用户 Key**。公开模型列表不能证明个人授权；JSON 格式能力不能代替应用层 Schema 与语义校验。

2026-11-03 补充核验：[官方入门](https://api-docs.deepseek.com/) 当前使用 deepseek-flash；[Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/) 默认启用思考，可使用 thinking.type=disabled。首版仅对 api.deepseek.com 显式关闭思考，确保最小连接测试的 128 token 预算用于最终内容；自定义兼容接口不发送此扩展字段。真实兼容性仍须凭有效 Key 验收。

S4 的核验记录应只保存 provider、模型 ID、成功/失败、错误码、延迟、输出是否合法和 usage 摘要；不要记录 API Key 或完整鉴权头。
