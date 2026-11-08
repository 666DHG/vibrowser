package services.generation.utils
import org.jsoup.Jsoup
import scala.jdk.CollectionConverters.*
import services.generation.objects.DesignDraft

private[generation] object DesignDrafts:
  // Drafts are stored model input, never rendered. Final documents still use the full validator.
  def check(draft: DesignDraft): Unit =
    require(draft.title.trim.nonEmpty && draft.title.length <= 500, "视觉草稿标题无效")
    require(draft.description.length <= 3000, "视觉草稿描述过长")
    require(
      draft.html.trim.nonEmpty && draft.html.length + draft.css.length <= 120000,
      "视觉草稿内容超出预算或为空"
    )
    val style = draft.siteStyle
    require(
      List(style.brand, style.typography, style.palette, style.layout).forall(s =>
        s.trim.nonEmpty && s.length <= 3000
      ),
      "视觉草稿站点风格无效"
    )
    val body = Jsoup.parseBodyFragment(draft.html).body()
    require(body.getAllElements.size <= 2001, "视觉草稿节点超出预算")
    var pending = List(body -> 1)
    while pending.nonEmpty do
      val (element, depth) = pending.head
      require(depth <= 25, "视觉草稿嵌套超出预算")
      pending = element.children().asScala.map(_ -> (depth + 1)).toList ::: pending.tail
