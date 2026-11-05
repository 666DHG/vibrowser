package services.browser.api
import cats.effect.IO
import java.sql.Connection
import services.system.api.APIMessage
import services.browser.objects.*
import services.browser.utils.AddressRules
final case class NormalizeWebDocumentMessage(document: WebDocument, address: String)
    extends APIMessage[WebDocument]:
  override def plan(connection: Connection): IO[WebDocument] = IO.pure {
    import scala.jdk.CollectionConverters.*
    val parsed = org.jsoup.Jsoup.parseBodyFragment(document.html)
    val inline = parsed
      .select("[style]")
      .asScala
      .toList
      .zipWithIndex
      .map { (element, index) =>
        val name = "vib-inline-" + index
        val rule = "." + name + "{" + element.attr("style") + "}"
        element.removeAttr("style").addClass(name)
        rule
      }
      .mkString("\n")
    val existingIds = parsed.select("[id]").asScala.map(_.id()).toSet ++ document.actions.map(_.id)
    val links = parsed
      .select("a[href]")
      .asScala
      .toList
      .filterNot(e =>
        e.attr("href").startsWith("#") || document.actions.exists(_.elementId == e.id())
      )
      .zipWithIndex
      .map { (e, index) =>
        val id =
          if e.id().nonEmpty then e.id()
          else
            Iterator
              .from(index)
              .map(i => "vib-link-" + i)
              .find(i => !existingIds(i) && parsed.getElementById(i) == null)
              .get
        e.attr("id", id)
        WebAction("vib-nav-" + id, WebActionKind.Navigate, id, target = Some(e.attr("href")))
      }
    val ids = document.entities
      .map(e => e.id -> AddressRules.resolveLink(e.id, address).getOrElse(e.id))
      .toMap
    document.copy(
      html = parsed.body().html(),
      css = document.css + "\n" + inline,
      actions = document.actions ++ links,
      entities = document.entities.map(e => e.copy(id = ids(e.id))),
      bindings =
        document.bindings.map(b => b.copy(entityId = ids.getOrElse(b.entityId, b.entityId))),
      subjectEntityId = document.subjectEntityId.map(id => ids.getOrElse(id, id))
    )
  }
