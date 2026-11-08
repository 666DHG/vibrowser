package services.browser.utils
import org.jsoup.nodes.{Document, Element}
import scala.jdk.CollectionConverters.*
import services.browser.objects.*
import services.system.objects.AppError

private[browser] object WebDocumentBindings:
  def value(entity: PageEntity, field: EntityField): Option[String] = field match
    case EntityField.Title       => entity.title
    case EntityField.Summary     => entity.summary
    case EntityField.Author      => entity.author
    case EntityField.PublishedAt => entity.publishedAt
    case EntityField.ReplyCount  => entity.replyCount.map(_.toString)
    case EntityField.Price       => entity.price.map(p => p.amount.toString + " " + p.currency)
    case EntityField.LegacyMeta  => entity.legacyMeta

  private def normalized(s: String): String = s.trim.replaceAll("\\s+", " ")
  private def textLeaf(e: Element): Boolean = e.children().isEmpty &&
    !Set("input", "textarea", "select", "option", "script", "style")(e.normalName())

  def normalize(
      parsed: Document,
      bindings: List[WebBinding],
      entities: List[PageEntity],
      address: String
  ): List[WebBinding] =
    def allocate(element: Element): String =
      if element.id().isEmpty then
        val id = Iterator
          .from(0)
          .map(i => "vib-entity-" + i)
          .find(id => parsed.getElementById(id) == null)
          .get
        element.attr("id", id)
      element.id()
    val inline = parsed.select("[data-entity-id][data-entity-field]").asScala.toList.map { e =>
      val field = EntityField.values
        .find(_.toString.equalsIgnoreCase(e.attr("data-entity-field")))
        .getOrElse(throw AppError("invalid_content", "未知实体字段: " + e.attr("data-entity-field"), 502))
      val entity = AddressRules
        .resolveEntityId(e.attr("data-entity-id"), address)
        .getOrElse(e.attr("data-entity-id"))
      e.attr("data-entity-id", entity).attr("data-entity-field", field.toString)
      WebBinding(allocate(e), entity, field)
    }
    val explicit = bindings.map { b =>
      val actual = Option(parsed.getElementById(b.elementId))
        .orElse(
          if b.elementId.startsWith("#") then Option(parsed.getElementById(b.elementId.drop(1)))
          else None
        )
      actual match
        case Some(e) => b.copy(elementId = e.id())
        case None =>
          val marked = inline.filter(i => i.entityId == b.entityId && i.field == b.field)
          if marked.size == 1 then marked.head
          else
            val expected =
              entities.find(_.id == b.entityId).flatMap(value(_, b.field)).filter(_.trim.nonEmpty)
            val matches = expected.toList
              .flatMap(v =>
                parsed
                  .body()
                  .getAllElements
                  .asScala
                  .filter(e => textLeaf(e) && normalized(e.text()) == normalized(v))
              )
              .toList
            // Reconnect only when the visible value identifies exactly one leaf.
            // Repeated titles and mismatches remain explicit validation failures.
            if matches.size == 1 && !bindings.exists(x =>
                x != b && x.elementId == matches.head.id()
              )
            then b.copy(elementId = allocate(matches.head))
            else b
    }
    (explicit ++ inline).distinct

  def issues(doc: WebDocument, parsed: Document): List[String] =
    val ids = parsed.select("[id]").asScala.map(_.id()).toSet
    val available = ids.toList.sorted.take(100).mkString(", ")
    val bindingIssues = doc.bindings.zipWithIndex.flatMap { (b, index) =>
      val prefix =
        "bindings[" + index + "] elementId=" + b.elementId + ", entityId=" + b.entityId + ", field=" + b.field
      List(
        Option.when(!ids(b.elementId))(
          prefix + ": binding element missing; 在 HTML 添加这个 ID，或改为现有正确元素；不要删除正文或实体字段"
        ),
        Option.when(!doc.entities.exists(_.id == b.entityId))(prefix + ": binding entity missing"),
        Option(parsed.getElementById(b.elementId))
          .filter(e => !e.children().isEmpty)
          .map(_ => prefix + ": binding must use text leaf element; 将绑定移到纯文本 span，保留外层链接与图标"),
        Option(parsed.getElementById(b.elementId))
          .filter(e => b.field == EntityField.Summary && e.text().trim.nonEmpty)
          .flatMap(e =>
            doc.entities
              .find(_.id == b.entityId)
              .filter(entity => normalized(e.text()) != normalized(entity.summary.getOrElse("")))
          )
          .map(_ =>
            prefix + ": summary binding would overwrite visible content; 正文保留在无字段绑定的元素，摘要使用空元素或与实体 summary 一致的文本"
          )
      ).flatten
    }
    val actionIssues = doc.actions.zipWithIndex.flatMap { (a, i) =>
      List(
        Option.when(!ids(a.elementId))(
          "actions[" + i + "] " + a.id + ": action element missing: " + a.elementId
        ),
        a.region
          .filterNot(ids)
          .map(r => "actions[" + i + "] " + a.id + ": action region missing: " + r)
      ).flatten
    }
    val errors = bindingIssues ++ actionIssues
    if errors.isEmpty then Nil else errors.take(12) :+ ("现有 HTML IDs: " + available)
