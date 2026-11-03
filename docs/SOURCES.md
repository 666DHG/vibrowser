# 规划依据与核验记录

整理日期：2026-11-03。

## 原始对话

[Vibe Browser方案](chatgpt-conversation://6ae9b79c-1078-83ea-8bcf-216a24897bcf)，已读取全部三轮及随附的 `tokenhub_student_quickstart.txt`。未将完整聊天、临时附件路径或凭据复制进仓库。

用户明确表达：三天开发窗口；期中作品；从原游戏方向转为 Vibe Browser；实时生成网页和不存在的本地文件；持有 DeepSeek 与腾讯 API；需要梳理前端交互与后端 AI 的架构。

原对话建议：React/TypeScript、Scala 3/Cats Effect/http4s、PostgreSQL；PageSpec 优先；声明式 Action；缓存与网站设定；有限校验修复；图片异步；不开发通用 Agent。技术栈的课程强制性来自对话中助手的描述，未读取原课程评分细则，因此本项目沿用该栈作为设计基线，不宣称已独立确认课程要求。

本次工程取舍：默认 Vibe 模式，不自动探测真实网址；真实网页显式外部打开；核心 P0 优先于搜索和生图；浏览器历史暂存 localStorage；补充任务去重、重启恢复、跨端契约样例和验收矩阵。它们是当前开发建议，并非原对话中用户逐项确认的要求。

## API 资料

| 来源 | 本次核验结果 | 仍待实测 |
| --- | --- | --- |
| 对话附件：TokenHub 学生 API 使用速查 | 广州地址 `https://tokenhub.tencentmaas.com/v1`，文本模型 `deepseek-v4.1-flash`；列出全景图能力，未列出常规 WAND/Kling 文生图授权 | 当前 Key 权限、额度、耗时和真实响应 |
| [腾讯官方模型列表](https://cloud.tencent.com/document/product/1823/130051) | 官方列表包含 `deepseek-v4.1-flash`；对话模型名称有公开依据 | 具体账户能否调用 |
| [腾讯 API 使用说明](https://cloud.tencent.com/document/product/1823/130078) | 广州接入域名、Bearer 鉴权和 `GET /v1/models` 查询方式有官方说明；地域配置需要对应 | 当前 Key 的模型列表与最小生成请求 |
| [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/) | `response_format: {type: json_object}`，Prompt 需明确 JSON；须处理空白与截断输出 | TokenHub 的对应模型参数兼容性与 Schema 合格率 |

本次只进行了资料读取与公开文档核验，**没有调用收费模型 API，也没有验证用户 Key**。公开模型列表不能证明个人授权；JSON 格式能力不能代替应用层 Schema 与语义校验。

D1.5 的核验记录应只保存 provider、模型 ID、成功/失败、错误码、延迟、输出是否合法和 usage 摘要；不要记录 API Key 或完整鉴权头。
