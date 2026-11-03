package services.browser.utils
import java.net.URI
import io.circe.syntax.*
import services.browser.objects.*

private[browser] object NavigationContexts:
  private def path(blocks: List[PageBlock], id: String): Option[List[PageBlock]] =
    blocks.iterator
      .map(b => if b.id == id then Some(List(b)) else path(b.items, id).map(b :: _))
      .collectFirst { case Some(found) => found }

  private def sameSite(a: String, b: String): Boolean =
    val left = URI.create(a)
    val right = URI.create(b)
    left.getScheme == right.getScheme && left.getAuthority == right.getAuthority

  private def fit(context: NavigationContext): NavigationContext =
    if context.asJson.noSpaces.length <= 24000 then context
    else if context.entities.size > 1 then
      fit(context.copy(entities = context.entities.dropRight(1)))
    else if context.containers.nonEmpty then
      fit(context.copy(containers = context.containers.dropRight(1)))
    else if context.ancestors.nonEmpty then fit(context.copy(ancestors = context.ancestors.tail))
    else context

  private[browser] def capture(
      source: Option[PageRecord],
      blockId: Option[String],
      target: String
  ): Either[String, Option[NavigationContext]] =
    blockId match
      case None => Right(None)
      case Some(id) =>
        for
          page <- source.toRight("来源页面不存在")
          spec <- page.spec.toRight("来源页面尚未就绪")
          selectedPath <- path(spec.blocks, id).toRight("来源组件不存在")
          block = selectedPath.last
          link <- block.target.toRight("来源组件没有链接")
          resolved <- AddressRules.resolveLink(link, page.address)
          _ <- Either.cond(resolved == target, (), "来源组件与目标地址不匹配")
          local = sameSite(page.address, target)
          bound = block.entityId.flatMap(id => spec.entities.find(_.id == id))
          selected = NavigationItem(
            block.id,
            block.`type`,
            target,
            bound.flatMap(_.title).orElse(block.title),
            bound.flatMap(_.summary).orElse(block.text),
            block.meta
          )
          inherited = (spec.entities ++ page.navigationContext.toList.flatMap(_.entities))
            .distinctBy(_.id)
          kind = block.`type` match
            case BlockType.Thread  => EntityKind.Thread
            case BlockType.Article => EntityKind.Article
            case BlockType.Product => EntityKind.Product
            case _                 => EntityKind.Page
          // Legacy free-form metadata remains verbatim; it is never parsed into guessed facts.
          legacy = Option.when(spec.schemaVersion == 1 && block.title.exists(_.nonEmpty))(
            PageEntity(target, kind, block.title, block.text, legacyMeta = block.meta)
          )
          primary = inherited.find(_.id == target).orElse(legacy)
          entities =
            if local then
              (primary.toList ++ inherited.filter(e => sameSite(e.id, target))).distinctBy(_.id)
            else Nil
          appearance = Option.when(local)(
            SiteAppearance(
              spec.title,
              spec.description,
              spec.theme,
              spec.design,
              spec.blocks
                .find(_.`type` == BlockType.Navbar)
                .flatMap(_.title)
                .orElse(page.navigationContext.flatMap(_.appearance).flatMap(_.brand))
            )
          )
          containers =
            if local then
              selectedPath
                .dropRight(1)
                .map(b =>
                  AncestorSummary(page.address, b.title.getOrElse(""), b.text.getOrElse(""))
                )
            else Nil
          ancestors =
            if local then
              (page.navigationContext.toList.flatMap(_.ancestors) :+
                AncestorSummary(page.address, spec.title, spec.description)).takeRight(3)
            else Nil
          snapshot = fit(
            NavigationContext(target, selected, containers, appearance, entities, ancestors)
          )
          _ <- Either.cond(snapshot.asJson.noSpaces.length <= 24000, (), "所选条目超出上下文预算")
        yield Some(snapshot)
