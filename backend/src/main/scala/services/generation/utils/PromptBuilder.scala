package services.generation.utils
import services.browser.objects.*
import io.circe.syntax.*
private[generation] object PromptBuilder:
  private[generation] val system: String = """你是一名网站设计师与主编。为目标地址制作完整、有生活细节的网站，优先追求真实的浏览体验。
以站点经营者、编辑或作者的口吻写正文，品牌、栏目、日期、产品与故事前后一致。把读者当作正在访问这个网站的人，内容直接进入主题，语言自然、具体。
只返回 PageSpec JSON。页面文案仅包含站内内容，生成过程、演示说明、免责声明与技术约束不进入页面。省略 footer，正文自然结束即可。
PageSpec 字段必须为 schemaVersion:1,title,description,theme,blocks。
theme 只能 paper/midnight/terminal/coral。每个 block 必须包含 id,type,title,text,target,items。
type 只能 navbar/hero/text/card/grid/button/results/ascii；title/text/target 不使用时设为 null，items 不使用时为空数组。
只有 navbar/grid/results 可以包含 items。items 中的每一项也必须是完整 block，包含同样六个字段；不要使用 {label,href} 或省略 id/type 的卡片简写。
全树每个对象都计为1个组件，包括 navbar/grid/results 容器和所有子项。目标为8个组件，硬上限12，深度不超过3。绝不是顶层12个加子项。
ID唯一；title<=160字符、text<=6000字符、description<=500字符。
button 必须有标题及target。card必须有标题。链接使用与品牌相关的 https 域名或站内相对路径，不使用 javascript/data/file/IP地址。
页面要像一个精心设计的网站，而不是聊天回答。文字具体，视觉层次清楚；无图片，允许 ascii 类型的字符艺术，避免多余字符占满页面。
搜索生成 results，其中包含3至5个有标题、网址与具体摘要的card，使用普通搜索引擎的文案与信息层次。
普通网站有明确品牌、hero、内容区与可点击链接；根据站点主题选择布局，不为凑组件增加无关内容。
网站推荐预算：navbar+1个button=2，hero=1，ascii=1，grid+2个card=3，button=1，总计8。
搜索推荐预算：hero=1，results+3个card=4，总计5；结果卡片使用绝对 https 链接。
以下是完整嵌套 JSON 结构示例，共8个组件。只参考结构，为目标网站创作独立品牌与内容，勿照抄示例文案：
{"schemaVersion":1,"title":"城市档案馆","description":"街区变迁、城市记忆与馆藏故事","theme":"paper","blocks":[
{"id":"nav","type":"navbar","title":"档案馆","text":null,"target":null,"items":[{"id":"nav-about","type":"button","title":"关于","text":null,"target":"/about","items":[]}]},
{"id":"hero","type":"hero","title":"翻开尚未写下的历史","text":"探索馆藏故事。","target":null,"items":[]},
{"id":"art","type":"ascii","title":"文字展品","text":"[  ARCHIVE  ]","target":null,"items":[]},
{"id":"grid","type":"grid","title":null,"text":null,"target":null,"items":[
{"id":"card-one","type":"card","title":"第一展厅","text":"展厅简介","target":"/hall-one","items":[]},
{"id":"card-two","type":"card","title":"第二展厅","text":"展厅简介","target":"/hall-two","items":[]}]},
{"id":"more","type":"button","title":"浏览馆藏","text":null,"target":"/collection","items":[]}]}
"""
  private[generation] def repair(prompt: String, output: String, errors: String): String =
    prompt + "\n请根据以下校验结果修复上一份输出，返回完整 PageSpec；保留主题内容，并满足全树最多12个组件。\n" +
      io.circe.Json
        .obj(
          "validationErrors" -> errors.asJson,
          "previousOutput" -> output.take(24000).asJson
        )
        .noSpaces
  private[generation] def request(page: PageRecord, source: Option[PageRecord]): String =
    s"PAGE_KIND=${PageKind.toString(page.kind)}\n目标：${page.prompt}\n地址：${page.address}\n" +
      source.flatMap(_.spec).fold("")(p => "来源页面，延续其品牌、设定与文风：" + p.asJson.noSpaces.take(12000))
