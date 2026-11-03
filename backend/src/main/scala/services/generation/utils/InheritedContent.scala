package services.generation.utils
import cats.syntax.all.*
import services.browser.objects.*
import services.system.objects.AppError

private[generation] object InheritedContent:
  private def merge(known: PageEntity, generated: PageEntity): Either[AppError, PageEntity] =
    def field[A](name: String, old: Option[A], next: Option[A]): Either[AppError, Option[A]] =
      if old.nonEmpty && next.nonEmpty && old != next then
        Left(AppError("invalid_content", s"实体 ${known.id} 的 $name 与来源事实冲突；必须原样继承", 502))
      else Right(next.orElse(old))
    val legacyOnly =
      known.legacyMeta.nonEmpty && known.author.isEmpty && known.publishedAt.isEmpty && known.replyCount.isEmpty && known.price.isEmpty
    for
      _ <- Either.cond(
        !legacyOnly || (generated.author.isEmpty && generated.publishedAt.isEmpty && generated.replyCount.isEmpty && generated.price.isEmpty),
        (),
        AppError("invalid_content", "旧条目只有原始 legacyMeta，不得猜测拆解为作者、时间、回复数或价格", 502)
      )
      _ <- Either.cond(
        known.kind == generated.kind,
        (),
        AppError("invalid_content", "实体类型与来源冲突", 502)
      )
      title <- field("title", known.title, generated.title)
      summary <- field("summary", known.summary, generated.summary)
      author <- field("author", known.author, generated.author)
      publishedAt <- field("publishedAt", known.publishedAt, generated.publishedAt)
      replyCount <- field("replyCount", known.replyCount, generated.replyCount)
      price <- field("price", known.price, generated.price)
      legacyMeta <- field("legacyMeta", known.legacyMeta, generated.legacyMeta)
    yield generated.copy(
      title = title,
      summary = summary,
      author = author,
      publishedAt = publishedAt,
      replyCount = replyCount,
      price = price,
      legacyMeta = legacyMeta
    )

  private[generation] def prepare(spec: PageSpec, page: PageRecord): Either[AppError, PageSpec] =
    val known = page.navigationContext.toList.flatMap(_.entities)
    val subject = known.find(_.id == page.address)
    for
      _ <- Either.cond(
        spec.schemaVersion == 2,
        (),
        AppError("invalid_content", "新生成页面须使用 schemaVersion:2", 502)
      )
      _ <- Either.cond(
        subject.isEmpty || spec.subjectEntityId.forall(_ == page.address),
        (),
        AppError("invalid_content", "subjectEntityId 必须引用所点击实体", 502)
      )
      merged <- spec.entities.traverse(e =>
        known.find(_.id == e.id).fold(Right(e): Either[AppError, PageEntity])(merge(_, e))
      )
      // Restore omitted known entities only when referenced, or when they are the requested subject.
      refs = all(spec.blocks).flatMap(_.entityId).toSet ++ subject.map(_.id)
      entities = merged ++ known.filter(e => refs(e.id) && !merged.exists(_.id == e.id))
      result = spec.copy(
        entities = entities,
        subjectEntityId = spec.subjectEntityId.orElse(subject.map(_.id))
      )
    yield result

  private def all(blocks: List[PageBlock]): List[PageBlock] = blocks.flatMap(b => b :: all(b.items))
