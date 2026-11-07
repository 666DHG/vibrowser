package services.generation.utils
import org.jsoup.Jsoup
import services.browser.objects.{WebDocument, WebAction, WebActionKind}
import services.generation.objects.LayoutReport
private[generation] object DesignPreservation:
  private def content(doc: WebDocument): String =
    val body = Jsoup.parseBodyFragment(doc.html).body()
    body.select("nav, button, form, script, style").remove()
    body.text().filterNot(_.isWhitespace)

  // Local ordered text fragments survive markup, section moves and small editorial changes.
  // Multiset counts retain repeated prose; unrelated text cannot stand in for missing paragraphs.
  private def coverage(before: String, after: String): Double =
    if before.isEmpty then 1.0
    else
      val width = math.min(8, before.length)
      def fragments(text: String): Map[String, Int] =
        text.sliding(width).filter(_.length == width).toList.groupMapReduce(identity)(_ => 1)(_ + _)
      val (_, covered) = before
        .sliding(width)
        .zipWithIndex
        .foldLeft(
          (fragments(after), scala.collection.immutable.BitSet.empty)
        ) { case ((remaining, positions), (text, start)) =>
          val count = remaining.getOrElse(text, 0)
          if count == 0 then (remaining, positions)
          else (remaining.updated(text, count - 1), positions ++ (start until start + width))
        }
      covered.size.toDouble / before.length

  private def validTrigger(doc: WebDocument, action: WebAction): Boolean =
    Option(Jsoup.parseBodyFragment(doc.html).getElementById(action.elementId)).exists { element =>
      action.kind match
        case WebActionKind.Search | WebActionKind.Submit => element.normalName() == "form"
        case WebActionKind.Toggle | WebActionKind.Switch => element.normalName() == "button"
        case _                                           => false
    }

  def issues(
      before: WebDocument,
      after: WebDocument,
      repairTargets: Set[String] = Set.empty
  ): List[String] =
    val entities =
      before.entities.filterNot(e => after.entities.contains(e)).map(e => "实体事实变化: " + e.id)
    val actions =
      before.actions
        .filterNot { original =>
          after.actions.exists { updated =>
            original == updated || (
              (repairTargets(original.id) || repairTargets(original.elementId)) &&
                !validTrigger(before, original) && validTrigger(after, updated) &&
                original.copy(elementId = updated.elementId) == updated
            )
          }
        }
        .map(a => "动作功能变化: " + a.id)
    val bindings =
      before.bindings.filterNot(after.bindings.contains).map(b => "实体字段绑定变化: " + b.elementId)
    val retained = coverage(content(before), content(after))
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
