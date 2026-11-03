package services.browser.utils
import services.browser.objects.*
object PageValidation:
  private[browser] def validate(spec: PageSpec, base: String): List[ValidationIssue] =
    def inspect(block: PageBlock, depth: Int, path: String): List[ValidationIssue] =
      val own = List(
        Option.when(depth > 3)(ValidationIssue(path, "组件深度超过 3")),
        Option.when(block.id.isEmpty || block.id.length > 80)(
          ValidationIssue(path + ".id", "组件 ID 无效")
        ),
        Option.when(block.title.exists(_.length > 160) || block.text.exists(_.length > 6000))(
          ValidationIssue(path, "文本过长")
        ),
        Option.when(
          Set(BlockType.Button, BlockType.Card)(block.`type`) && block.title.forall(_.trim.isEmpty)
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
          block.items.nonEmpty && !Set(BlockType.Navbar, BlockType.Grid, BlockType.Results)(
            block.`type`
          )
        )(ValidationIssue(path, "该组件不允许子组件"))
      ).flatten
      own ++ block.items.zipWithIndex.flatMap((b, i) => inspect(b, depth + 1, s"$path.items[$i]"))
    def all(blocks: List[PageBlock]): List[PageBlock] = blocks.flatMap(b => b :: all(b.items))
    val flat = all(spec.blocks)
    List(
      Option.when(spec.schemaVersion != 1)(ValidationIssue("schemaVersion", "仅支持版本 1")),
      Option
        .when(spec.title.trim.isEmpty || spec.title.length > 160)(ValidationIssue("title", "标题无效")),
      Option.when(spec.description.length > 500)(ValidationIssue("description", "摘要过长")),
      Option.when(flat.isEmpty || flat.length > 12)(ValidationIssue("blocks", "组件总数须在 1–12 之间")),
      Option.when(flat.map(_.id).distinct.size != flat.size)(ValidationIssue("blocks", "组件 ID 重复"))
    ).flatten ++ spec.blocks.zipWithIndex.flatMap((b, i) => inspect(b, 1, s"blocks[$i]"))
