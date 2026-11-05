package services.browser.api
import scala.jdk.CollectionConverters.*
import cats.effect.IO
import java.sql.Connection
import services.system.api.APIMessage
import services.browser.objects.*
import services.browser.utils.{AddressRules, WebDocumentBindings}
final case class NormalizeWebDocumentMessage(document: WebDocument, address: String)
    extends APIMessage[WebDocument]:
  override def plan(connection: Connection): IO[WebDocument] = IO {
    val parsed = org.jsoup.Jsoup.parseBodyFragment(document.html)
    val contacts = parsed
      .select("a[href]")
      .asScala
      .filter(e => {
        val href = e.attr("href").toLowerCase(java.util.Locale.ROOT)
        href.startsWith("mailto:") || href.startsWith("tel:")
      })
      .toList
    val contactIds = contacts.map(_.id()).filter(_.nonEmpty).toSet
    contacts.foreach(e =>
      e.tagName("span").removeAttr("href").removeAttr("target").removeAttr("rel")
    )
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
    val actions = document.actions
      .filterNot(a => a.kind == WebActionKind.Navigate && contactIds(a.elementId))
      .map { a =>
        val marked =
          parsed.select("[data-action-id]").asScala.filter(_.attr("data-action-id") == a.id).toList
        val element = Option(parsed.getElementById(a.elementId))
          .orElse(if marked.size == 1 then Some(marked.head) else None)
          .orNull
        if element != null && element.id().isEmpty then
          val id =
            if a.elementId.nonEmpty then a.elementId
            else
              Iterator
                .from(0)
                .map(i => "vib-action-" + i)
                .find(id => parsed.getElementById(id) == null)
                .get
          element.attr("id", id)
        val resolved = if element != null then a.copy(elementId = element.id()) else a
        if element != null && Set(
            WebActionKind.Search,
            WebActionKind.Submit,
            WebActionKind.Replace,
            WebActionKind.Append
          )(a.kind) && element.normalName() != "form"
        then
          Option(element.closest("form"))
            .filter(_.id().nonEmpty)
            .fold(resolved)(form => resolved.copy(elementId = form.id()))
        else resolved
      }
    // Form submission belongs to the declared host action, not the generated action/method URL.
    // Standard form attributes are redundant here and need no model round-trip.
    actions.filter(a => Set(WebActionKind.Search, WebActionKind.Submit)(a.kind)).foreach { a =>
      Option(parsed.getElementById(a.elementId)).filter(_.normalName() == "form").foreach { form =>
        form.removeAttr("action").removeAttr("method")
      }
    }
    val existingIds = parsed.select("[id]").asScala.map(_.id()).toSet ++ actions.map(_.id)
    val links = parsed
      .select("a[href]")
      .asScala
      .toList
      .filterNot(e => e.attr("href").startsWith("#") || actions.exists(_.elementId == e.id()))
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
      .map(e => e.id -> AddressRules.resolveEntityId(e.id, address).getOrElse(e.id))
      .toMap
    val entities = document.entities.map(e => e.copy(id = ids(e.id)))
    val bindings = WebDocumentBindings.normalize(
      parsed,
      document.bindings.map(b => b.copy(entityId = ids.getOrElse(b.entityId, b.entityId))),
      entities,
      address
    )
    document.copy(
      html = parsed.body().html(),
      css = document.css + "\n" + inline,
      actions = actions ++ links,
      entities = entities,
      bindings = bindings,
      subjectEntityId = document.subjectEntityId.map(id => ids.getOrElse(id, id))
    )
  }
