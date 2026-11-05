package services.generation.utils
import services.browser.objects.*
import io.circe.Json
import io.circe.syntax.*
private[generation] object WebDocumentPrompt:
  val system = """生成完整的中文网站 WebDocument v3 JSON。自由设计 HTML/CSS，不使用统一模板。依据站点用途选择字体、内容密度、布局、导航、颜色。不要把所有页面做成标题加卡片。文字、表格、密集列表、侧栏与表单应有真实内容。
返回字段 schemaVersion:3,title,description,html,css,siteStyle:{brand,typography,palette,layout},entities:[],bindings:[],actions:[],initialState 所有值必须是字符串，例如 {"cart":"0"}。域名实体 id 必须使用 target.address 中的 Punycode 域名，不用中文域名。
initialState:{},persistentKeys:[],subjectEntityId:null。
html 是 body 片段，CSS 单独提供；不用 style 属性、script、图片、SVG、iframe、外部资源或字体。使用标准语义 HTML、CSS、系统字体、文字插画。支持响应式窄屏。每个可操作按钮都应有实际动作，不能只是装饰。
按用途提供可操作功能：论坛列表至少有站内搜索与帖子链接，帖子详情有 Toggle 展开回复与 Append 加载更多；商店列表有 Filter 筛选和 Sort 排序，商品详情有 Set 规格选择与 Increment 购物车；文档站有 Toggle 目录、章节导航和 Search。Sort 的 select 使用 asc/desc option，Filter 的“全部”选项值为空字符串。
每个动作 {id,kind,elementId,target,region,stateKey,value,field}，可选字段为 null。id 与 elementId 唯一，elementId 必须存在于 HTML。
kind: Navigate/Search/Submit/Replace/Append/Toggle/Switch/Filter/Sort/Set/Increment（大小写准确）。
Navigate: target 为 HTTP(S) URL 或站内相对路径，绑定 a 或 button。所有 a（除 #锚点）必须声明 Navigate，href 与 target 一致。
Search: 绑定 form，里面有 label、name=q 的 required input 和 submit button，表示当前站点搜索。无需 region。不能绑定提交按钮本身。
Append/Replace/Submit: 必须指定已有 region 元素 ID，后端生成该区域追加或替换内容。Submit 绑定 form，Append 可绑定加载更多按钮。
Toggle: region 指定展开区域，初始可 hidden。Switch: region 的直接子元素按 value 指定的 ID 切换。
Filter: 绑定 input，region 的直接子元素按文字或 data-{field} 筛选。Sort: 绑定 button/select，region 子项按 data-{field} 排序，value 为 asc/desc。
Set/Increment: stateKey 指定 initialState 已声明的键。Set 的 value 或 select 值更新键，Increment 的 value 为数值增量。用 <output data-state="键"> 显示状态。persistentKeys 指定允许收藏的派生状态键。输入草稿不要放 persistentKeys。
entities 每项 {id:规范绝对URL,kind:thread/article/product/page,title,summary,author,publishedAt,replyCount,price:{amount,currency},legacyMeta}，不用的字段 null。bindings 每项 {elementId,entityId,field}，field 是 Title/Summary/Author/PublishedAt/ReplyCount/Price/LegacyMeta。绑定元素必须是纯文本叶节点，宿主填入事实。帖子、文章、商品的标题和元信息都绑定实体。主体详情使用 subjectEntityId 当前地址。
上下文已知实体的事实逐字继承；正文扩展放 HTML，不改变摘要/标题/作者/价格/回复总数。回复总数与实际展示数量分开。站内延续 siteStyle；跨站重新设计。
网站搜索结果可以包含实体与详情链接。跨站搜索页链接必须是绝对 HTTP(S) 地址，不能使用内部 vibe:// 地址作为站点。
HTML/CSS 合计最多120000字符，2000节点，24层，64动作，128实体。通常用紧凑CSS和充实正文控制输出长度。只返回 JSON，不使用 markdown 围栏。
"""
  def request(page: PageRecord): String = Json
    .obj(
      "target" -> GenerationTargets.describe(page).asJson,
      "navigationContext" -> page.navigationContext.asJson
    )
    .noSpaces
  def repair(prompt: String, output: String, error: String): String =
    prompt + "\n校验错误：" + error + "\n修复下列输出，返回完整 JSON：\n" + output.take(120000)
