# 地址含义丢失排查

2026-11-03。针对用户反馈“网址和生成内容牛头不对马嘴”的专项修复。

## 已确认原因

1. **中文域名的语义在进入模型前丢失。** `AddressRules.web` 将域名规范化为 Punycode，并把同一个规范网址同时作为 `canonical` 和 `prompt` 返回。导航保存后，PromptBuilder 的 input/address 都只剩 `xn--...`。例如 `清华树洞.com` 被保存为 `https://xn--xkr069b3udl0a.com/`，模型看不到“清华树洞”。
2. **生成任务缺少明确的搜索语义。** 旧请求只有 PAGE_KIND 标识和 target。读取用户的失败任务，错误是多个结果 target 与 entityId 不匹配。另做一次独立模型诊断复现了站内相对链接 `/articles/...`、相对实体 ID，以及把实体类型 `page` 当组件类型的情况。独立诊断不是原失败请求的原始输出，也没有计为成功生成。
3. **旧结果会持续命中缓存。** 成功生成但主题错误的页面已经存入 PostgreSQL；刷新只读缓存，因此模型提示修复后，原地址也不会自动变化。最近三条错误网站均为独立输入，referrer/context 为空，排除了父页上下文串入这一原因。

| 用户地址 | 修复前缓存内容 |
| --- | --- |
| 清华树洞.com | 書架之間 · 獨立 Reader 書評誌 |
| 一二三四五上山打老虎.com | 松风堂 · 山野记事与旧物 |
| jt8-3合集.com | 山取 · 山野采集与植物记录 |

上轮验收的论坛路径均为英文域名，未覆盖这一中文域名分支。

## 修复

- `AddressRules.classify` 保留用户去掉首尾空白后的原始输入作为 prompt；规范地址继续用于缓存去重、校验与实体身份，二者不再混用。
- 新增独立 `GenerationTarget` final case class 与编解码器；generation 内部纯函数 `GenerationTargets.describe` 输出 readableAddress、Unicode host、解码后的 path/query、原始 input 与 kind。即使读取旧任务中只剩编码地址的记录，也能还原域名含义。
- Prompt 明确优先依据原始输入、可读域名专名和路径用途确定内容；Punycode 是地址编码，不是主题。保持现有 PageSpec v2 和点击路径事实规则。
- 搜索任务明确生成跨网站结果，使用绝对 HTTP(S) 目标、普通 card 和空主体引用。区分实体 kind 与组件 type；实体绑定仍须匹配目标，未放宽验证。
- 链接冲突修复提示提供 target、解析后的地址与 entityId，不再只给一条无法定位差异的笼统错误。
- 根据 [官方说明](https://api-docs.deepseek.com/guides/thinking_mode/) 做过 low 思考对照。JT8-3仍未识别正确，仅从软件资料变成无关游戏设定，且耗时增加；已撤回 provider 参数变化，保留原 disabled 行为。没有把未经证明的设置作为修复交付。

没有修改成功缓存、书签或缓存优先策略，没有新增自动重建入口。原失败搜索可按既有重试机制修复。新代码已在 LIVE 模式运行。

## 验证

- Scala 格式、编译和 **57 项测试通过**，新增原始中文输入保留、编码/中文地址缓存身份一致、中文域名/路径/查询解码、旧记录语义恢复、搜索绝对链接及详细冲突提示测试。
- 前端源码未修改；格式检查通过，新增真实 Playwright 验收使用实际导航与任务接口。
- 真实生成使用原域名加查询参数，验证相同域名语义且不覆盖已有缓存；原搜索使用既有失败任务的显式重试。任务、耗时、结果和阶段见 [实际记录](acceptance/address-intent-2026-11-03.json)。

| 真实样本 | 主题核对 | 结果 |
| --- | --- | --- |
| 清华树洞.com/?view=latest | 校园树洞，不再是书评誌 | 通过；首次 16,846ms |
| 一二三四五上山打老虎.com/?view=latest | 童谣与民间故事，不再是山野旧物 | 通过；首次 22,833ms |
| 一二三四五上山打老虎（搜索） | 查询对应童谣；跨站绝对链接 | 原失败任务重试通过；19,114ms |
| jt8-3合集.com（三条新查询路径） | 用户确认是《明日方舟》JT8-3，也包括反串/整活素材，不应仅限定攻略 | **未通过**；前两次偏向软件/通用资料，low 思考对照偏向无关游戏，虽 JSON 与任务状态成功，仍未算主题正确 |

真实专项检查按人工语义复核为 3/4 通过。最初 JT8-3 断言包含过宽的“攻略”，导致 low 思考对照一度报告通过；截图和正文复查发现它编造了与明日方舟无关的章节、隐藏结局，故没有认可该自动结果。已收紧到明确作品/角色线索，并在历史记录追加 reviewedSemanticMatch:false 和原因，不改掉原有机器结果。模型识别不熟悉编号的能力是当前剩余问题。用户已确认 JT8-3 及相关素材语境；本轮没有硬编码某个域名到某个游戏，也没有引入额外 AI 意图判断请求或外部搜索。

独立模型诊断 1 次；真实页面新任务共 6 个（两个中文主题站、三个 JT8-3 探测、一次原失败搜索重试）。复验中的缓存命中均在记录中明确标注。

截图：[清华树洞](screenshots/address-intent/campus.png)、[童谣网站](screenshots/address-intent/rhyme.png)、[JT8-3（主题检查未通过）](screenshots/address-intent/game.png)、[搜索](screenshots/address-intent/search.png)。

重复运行命令（已缓存成功的地址会直接读取）：

```powershell
cd frontend
$env:VIBROWSER_LIVE_SMOKE = 'true'
npx.cmd playwright test --config playwright.live.config.ts address-intent.spec.ts
```

模型仍会创作具体内容；本轮消除的是输入信息丢失和任务类型歧义，不把有限样本成功率等同于所有网址的主题准确性保证。
