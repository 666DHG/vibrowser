package services.generation.utils
import services.browser.objects.*
import services.system.objects.AppError
import org.jsoup.Jsoup
import scala.jdk.CollectionConverters.*
private[generation] object WebActionResults:
  def combine(
      next: WebDocument,
      snapshot: Option[PageActionSnapshot]
  ): Either[AppError, WebDocument] = snapshot match
    case Some(s) if s.action.kind != WebActionKind.Search && next.css.trim.nonEmpty =>
      Left(AppError("invalid_content", "区域更新 css 必须为空，复用原页面样式类", 502))
    case Some(s) if s.action.kind != WebActionKind.Search =>
      val base = Jsoup.parseBodyFragment(s.document.html)
      val target = s.action.region.flatMap(id => Option(base.getElementById(id)))
      target.toRight(AppError("invalid_content", "更新区域不存在", 502)).map { region =>
        val removed =
          if s.action.kind == WebActionKind.Append then Set.empty[String]
          else region.children().asScala.flatMap(_.getAllElements.asScala.map(_.id())).toSet
        if s.action.kind == WebActionKind.Append then region.append(next.html)
        else region.html(next.html)
        s.document.copy(
          html = base.body().html(),
          entities = (next.entities ++ s.document.entities
            .filterNot(e => next.entities.exists(_.id == e.id))),
          bindings = s.document.bindings.filterNot(b => removed(b.elementId)) ++ next.bindings,
          actions = s.document.actions.filterNot(a => removed(a.elementId)) ++ next.actions,
          initialState = s.document.initialState ++ next.initialState,
          persistentKeys = (s.document.persistentKeys ++ next.persistentKeys).distinct
        )
      }
    case _ => Right(next)
