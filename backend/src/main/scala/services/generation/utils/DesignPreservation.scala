package services.generation.utils
import org.jsoup.Jsoup
import scala.jdk.CollectionConverters.*
import services.browser.objects.WebDocument
import services.generation.objects.LayoutReport
private[generation] object DesignPreservation:
  private def content(doc: WebDocument): Set[String] =
    Jsoup
      .parseBodyFragment(doc.html)
      .body()
      .getAllElements
      .asScala
      .filter(_.children().isEmpty)
      .map(_.text().trim)
      .filter(_.length >= 12)
      .toSet
  def issues(before: WebDocument, after: WebDocument): List[String] =
    val entities =
      before.entities.filterNot(e => after.entities.contains(e)).map(e => "实体事实变化: " + e.id)
    val actions =
      before.actions.filterNot(a => after.actions.contains(a)).map(a => "动作功能变化: " + a.id)
    val bindings =
      before.bindings.filterNot(after.bindings.contains).map(b => "实体字段绑定变化: " + b.elementId)
    val facts = content(before)
    val retained =
      if facts.isEmpty then 1.0 else facts.intersect(content(after)).size.toDouble / facts.size
    entities ++ actions ++ bindings ++ List(
      Option.when(retained < 0.9)("主要正文覆盖不足，保留原有文本并调整排版"),
      Option.when(before.subjectEntityId != after.subjectEntityId)("主体引用变化"),
      Option.when(before.initialState.exists((k, v) => !after.initialState.get(k).contains(v)))(
        "初始状态变化"
      ),
      Option.when(!before.persistentKeys.forall(after.persistentKeys.contains))("可恢复状态声明丢失")
    ).flatten
  def layoutWorsened(before: LayoutReport, after: LayoutReport): Boolean =
    after.viewports.exists(v =>
      before.viewports
        .find(_.width == v.width)
        .exists(old => v.overflowIds.nonEmpty && old.overflowIds.isEmpty)
    )
