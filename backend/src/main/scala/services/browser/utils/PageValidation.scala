package services.browser.utils
import services.browser.objects.*
object PageValidation:
  private[browser] def validate(spec: PageSpec, base: String): List[ValidationIssue] =
    def inspect(block: PageBlock, depth: Int, path: String): List[ValidationIssue] =
      val own = List(
        Option.when(depth > PageLimits.maxDepth)(
          ValidationIssue(path, s"组件深度超过 ${PageLimits.maxDepth}")
        ),
        Option.when(block.id.isEmpty || block.id.length > 80)(
          ValidationIssue(path + ".id", "组件 ID 无效")
        ),
        Option.when(block.title.exists(_.length > 160) || block.text.exists(_.length > 6000))(
          ValidationIssue(path, "文本过长")
        ),
        Option.when(block.meta.exists(_.length > 240))(ValidationIssue(path + ".meta", "附注过长")),
        Option.when(block.style.flatMap(_.columns).exists(n => n < 1 || n > 4))(
          ValidationIssue(path + ".style.columns", "列数须在 1–4 之间")
        ),
        Option.when(
          Set(BlockType.Quote, BlockType.Code)(block.`type`) && block.text.forall(_.trim.isEmpty)
        )(ValidationIssue(path + ".text", "该组件需要正文")),
        Option.when(
          Set(
            BlockType.Button,
            BlockType.Card,
            BlockType.Article,
            BlockType.Product,
            BlockType.Thread,
            BlockType.Stat
          )(block.`type`) && block.title.forall(_.trim.isEmpty) && block.entityId.isEmpty
        )(ValidationIssue(path, "缺少标题")),
        Option.when(block.`type` == BlockType.Button && block.target.isEmpty)(
          ValidationIssue(path, "按钮缺少链接")
        ),
        Option.when(block.target.exists(_.length > 2048))(
          ValidationIssue(path + ".target", "链接过长")
        ),
        block.target.flatMap(t =>
          AddressRules
            .resolveLink(t, base)
            .left
            .toOption
            .map(m => ValidationIssue(path + ".target", m))
        ),
        Option.when(
          block.items.nonEmpty && !Set(
            BlockType.Navbar,
            BlockType.Grid,
            BlockType.Results,
            BlockType.Section,
            BlockType.List
          )(
            block.`type`
          )
        )(ValidationIssue(path, "该组件不允许子组件"))
      ).flatten
      own ++ block.items.zipWithIndex.flatMap((b, i) => inspect(b, depth + 1, s"$path.items[$i]"))
    def all(blocks: List[PageBlock]): List[PageBlock] = blocks.flatMap(b => b :: all(b.items))
    val flat = all(spec.blocks)
    List(
      Option.when(!Set(1, 2)(spec.schemaVersion))(ValidationIssue("schemaVersion", "仅支持版本 1、2")),
      Option
        .when(spec.title.trim.isEmpty || spec.title.length > 160)(ValidationIssue("title", "标题无效")),
      Option.when(spec.description.length > 500)(ValidationIssue("description", "摘要过长")),
      Option.when(flat.isEmpty || flat.length > PageLimits.maxBlocks)(
        ValidationIssue(
          "blocks",
          s"组件总数须在 1–${PageLimits.maxBlocks} 之间，当前为 ${flat.length}（包含所有嵌套子项）"
        )
      ),
      Option.when(flat.map(_.id).distinct.size != flat.size)(ValidationIssue("blocks", "组件 ID 重复"))
    ).flatten ++ EntityValidation.validate(spec, base, flat) ++ spec.blocks.zipWithIndex.flatMap(
      (b, i) => inspect(b, 1, s"blocks[$i]")
    )
