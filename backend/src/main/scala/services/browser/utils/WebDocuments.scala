package services.browser.utils
import services.browser.objects.*
import services.system.objects.AppError
import org.jsoup.Jsoup
import scala.jdk.CollectionConverters.*
import scala.util.Try
import com.helger.css.reader.CSSReader
import com.helger.css.ECSSVersion
import com.helger.css.writer.CSSWriter
private[browser] object WebDocuments:
  private val tags = Set(
    "body",
    "main",
    "header",
    "footer",
    "nav",
    "section",
    "article",
    "aside",
    "div",
    "span",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "a",
    "button",
    "form",
    "input",
    "select",
    "option",
    "textarea",
    "label",
    "fieldset",
    "legend",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "colgroup",
    "col",
    "pre",
    "code",
    "blockquote",
    "strong",
    "em",
    "small",
    "b",
    "i",
    "u",
    "s",
    "br",
    "hr",
    "details",
    "summary",
    "time",
    "output",
    "progress"
  )
  private val attributes = Set(
    "id",
    "class",
    "title",
    "role",
    "href",
    "type",
    "name",
    "value",
    "placeholder",
    "required",
    "disabled",
    "checked",
    "selected",
    "multiple",
    "min",
    "max",
    "step",
    "maxlength",
    "rows",
    "cols",
    "for",
    "tabindex",
    "open",
    "colspan",
    "rowspan",
    "scope",
    "hidden",
    "datetime",
    "autocomplete",
    "minlength",
    "readonly",
    "spellcheck",
    "dir",
    "lang",
    "start",
    "reversed",
    "wrap",
    "size",
    "inputmode",
    "autocapitalize",
    "autofocus"
  )
  private def requireThat(ok: Boolean, message: String): Unit =
    if !ok then throw AppError("invalid_content", message, 502)
  private[browser] def prepare(doc: WebDocument, address: String): Either[AppError, WebDocument] =
    Try {
      requireThat(doc.schemaVersion == 3, "schemaVersion must be 3")
      requireThat(doc.html.length + doc.css.length <= 120000, "document exceeds 120000 characters")
      requireThat(
        doc.actions.size <= 64 && doc.entities.size <= 128,
        "too many actions or entities"
      )
      val parsed = Jsoup.parseBodyFragment(doc.html)
      val nodes = parsed.body().getAllElements.asScala.toList
      requireThat(
        nodes.size <= 2000 && nodes.forall(_.parents().size <= 26),
        "DOM exceeds node/depth budget"
      )
      requireThat(parsed.head().children().isEmpty, "head elements are not allowed")
      requireThat(nodes.forall(e => tags(e.normalName())), "unsupported HTML element")
      requireThat(
        nodes.forall(e =>
          e.attributes()
            .asList
            .asScala
            .forall(a =>
              attributes(a.getKey) || a.getKey.startsWith("aria-") || a.getKey.startsWith("data-")
            )
        ),
        "unsupported HTML attribute: " + nodes
          .flatMap(e =>
            e.attributes()
              .asList
              .asScala
              .filterNot(a =>
                attributes(a.getKey) || a.getKey.startsWith("aria-") || a.getKey.startsWith("data-")
              )
              .map(a => e.normalName() + "[" + a.getKey + "]")
          )
          .distinct
          .mkString(", ")
      )
      requireThat(
        nodes
          .filter(_.normalName() == "input")
          .forall(e => !Set("password", "file", "image")(e.attr("type").toLowerCase)),
        "unsupported input type"
      )
      val ids = nodes.filter(_.hasAttr("id")).map(_.id())
      requireThat(ids.distinct.size == ids.size, "duplicate element id")
      requireThat(doc.actions.map(_.id).distinct.size == doc.actions.size, "duplicate action id")
      requireThat(
        doc.actions.map(_.elementId).distinct.size == doc.actions.size,
        "one action per element"
      )
      requireThat(doc.entities.map(_.id).distinct.size == doc.entities.size, "duplicate entity id")
      requireThat(
        doc.entities.forall(e => AddressRules.resolveLink(e.id, address).contains(e.id)),
        "entity id must be canonical URL: " + doc.entities
          .filterNot(e => AddressRules.resolveLink(e.id, address).contains(e.id))
          .map(e => e.id + " => " + AddressRules.resolveLink(e.id, address).getOrElse("invalid"))
          .mkString(", ")
      )
      requireThat(doc.entities.forall(_.replyCount.forall(_ >= 0)), "negative reply count")
      doc.actions.foreach { a =>
        requireThat(ids.contains(a.elementId), "action element missing: " + a.elementId)
        requireThat(a.region.forall(ids.contains), "action region missing")
        if a.kind == WebActionKind.Navigate then
          requireThat(
            a.target.exists(t => AddressRules.resolveLink(t, address).isRight),
            "navigation target invalid"
          )
        if Set(
            WebActionKind.Append,
            WebActionKind.Replace,
            WebActionKind.Submit,
            WebActionKind.Toggle,
            WebActionKind.Switch,
            WebActionKind.Filter,
            WebActionKind.Sort
          )(a.kind)
        then requireThat(a.region.nonEmpty, "action requires region: " + a.id)
      }
      nodes
        .filter(e => e.normalName() == "a" || e.normalName() == "form")
        .foreach(e =>
          requireThat(
            doc.actions.exists(_.elementId == e.id()) || (e
              .normalName() == "a" && e.attr("href").startsWith("#")),
            "link/form requires declared action: " + e.id()
          )
        )
      requireThat(
        doc.bindings.map(_.elementId).distinct.size == doc.bindings.size,
        "duplicate binding element"
      )
      doc.actions.filter(_.kind == WebActionKind.Navigate).foreach { a =>
        val element = parsed.getElementById(a.elementId)
        requireThat(
          !element.hasAttr("href") || AddressRules.resolveLink(
            element.attr("href"),
            address
          ) == a.target.map(t => AddressRules.resolveLink(t, address)).getOrElse(Left("missing")),
          "href and navigation target differ: " + a.id
        )
      }
      doc.actions.filter(a => Set(WebActionKind.Set, WebActionKind.Increment)(a.kind)).foreach {
        a =>
          requireThat(
            a.stateKey.exists(doc.initialState.contains),
            "state action requires declared state key"
          )
          if a.kind == WebActionKind.Increment then
            requireThat(
              a.value.forall(v => scala.util.Try(BigDecimal(v)).isSuccess),
              "increment value must be numeric"
            )
      }
      doc.actions
        .filter(_.kind == WebActionKind.Search)
        .foreach(a =>
          requireThat(
            parsed.getElementById(a.elementId).normalName() == "form",
            "Search must bind a form"
          )
        )
      doc.bindings.foreach { b =>
        requireThat(ids.contains(b.elementId), "binding element missing")
        val e = doc.entities
          .find(_.id == b.entityId)
          .getOrElse(throw AppError("invalid_content", "binding entity missing", 502))
        val value = b.field match
          case EntityField.Title       => e.title
          case EntityField.Summary     => e.summary
          case EntityField.Author      => e.author
          case EntityField.PublishedAt => e.publishedAt
          case EntityField.ReplyCount  => e.replyCount.map(_.toString)
          case EntityField.Price       => e.price.map(p => p.amount.toString + " " + p.currency)
          case EntityField.LegacyMeta  => e.legacyMeta
        requireThat(
          parsed.getElementById(b.elementId).children().isEmpty,
          "binding must use text leaf element"
        )
        parsed.getElementById(b.elementId).text(value.getOrElse(""))
      }
      requireThat(
        doc.subjectEntityId.forall(id => doc.entities.exists(_.id == id)),
        "subject entity missing"
      )
      requireThat(
        doc.persistentKeys.forall(doc.initialState.contains),
        "persistent state key missing"
      )
      requireThat(CSSReader.isValidCSS(doc.css, ECSSVersion.CSS30), "CSS syntax invalid")
      val css = Option(CSSReader.readFromString(doc.css, ECSSVersion.CSS30)).getOrElse(
        throw AppError("invalid_content", "CSS parse failed", 502)
      )
      val rendered = new CSSWriter(ECSSVersion.CSS30, false).getCSSAsString(css)
      val lower = rendered.toLowerCase(java.util.Locale.ROOT)
      requireThat(
        !List("url(", "@import", "@font-face", "@namespace", "expression(", "</style").exists(
          lower.contains
        ),
        "CSS resources are not allowed"
      )
      doc.copy(html = parsed.body().html(), css = rendered)
    }.toEither.left.map {
      case e: AppError => e
      case _           => AppError("invalid_content", "document parsing failed", 502)
    }
