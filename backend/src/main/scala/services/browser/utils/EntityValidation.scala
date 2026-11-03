package services.browser.utils
import services.browser.objects.*

private[browser] object EntityValidation:
  private[browser] def validate(
      spec: PageSpec,
      base: String,
      blocks: List[PageBlock]
  ): List[ValidationIssue] =
    val entities = spec.entities
    val index = entities.map(e => e.id -> e).toMap
    def issue(condition: Boolean, path: String, message: String) =
      Option.when(condition)(ValidationIssue(path, message))
    val own = List(
      issue(
        entities.size > 48 || entities.map(_.id).distinct.size != entities.size,
        "entities",
        "实体数量超过48或标识重复"
      ),
      issue(
        spec.schemaVersion == 1 && (entities.nonEmpty || spec.subjectEntityId.nonEmpty || blocks
          .exists(_.entityId.nonEmpty)),
        "entities",
        "实体引用需要版本2"
      ),
      issue(
        spec.subjectEntityId.exists(id => !index.contains(id) || id != base),
        "subjectEntityId",
        "主体须引用当前地址的实体"
      ),
      issue(
        spec.subjectEntityId.exists(id =>
          !blocks.exists(b => b.entityId.contains(id) && b.replyRange.isEmpty)
        ),
        "blocks",
        "详情页需要展示主体实体的标题和事实"
      )
    ).flatten
    val fields = entities.zipWithIndex.flatMap { (e, i) =>
      val path = s"entities[$i]"
      List(
        issue(
          e.id.length > 2048 || AddressRules.web(e.id).toOption.forall(_.canonical != e.id),
          path + ".id",
          "实体标识须为规范化绝对 HTTP(S) 地址"
        ),
        issue(
          e.title.forall(_.trim.isEmpty) || e.title.exists(_.length > 160),
          path + ".title",
          "实体标题无效"
        ),
        issue(e.summary.exists(_.length > 6000), path + ".summary", "实体摘要过长"),
        issue(
          e.author.exists(_.length > 160) || e.publishedAt.exists(_.length > 160) || e.legacyMeta
            .exists(_.length > 240),
          path,
          "实体事实过长"
        ),
        issue(e.replyCount.exists(_ < 0), path + ".replyCount", "回复总数不能为负"),
        issue(
          e.price.exists(p => p.amount < 0 || p.currency.isEmpty || p.currency.length > 12),
          path + ".price",
          "价格无效"
        )
      ).flatten
    }
    val refs = blocks.flatMap { b =>
      val entity = b.entityId.flatMap(index.get)
      List(
        issue(b.entityId.nonEmpty && entity.isEmpty, b.id + ".entityId", "实体引用不存在"),
        issue(
          spec.schemaVersion == 2 && b.target.nonEmpty && Set(
            BlockType.Thread,
            BlockType.Article,
            BlockType.Product
          )(b.`type`) && entity.isEmpty,
          b.id,
          "可进入详情的条目必须引用实体"
        ),
        issue(
          entity.nonEmpty && b.target.exists(t =>
            AddressRules.resolveLink(t, base).toOption != b.entityId
          ),
          b.id + ".target",
          "链接与实体地址不匹配"
        ),
        issue(
          b.replyRange.exists(r =>
            r.from < 1 || r.to < r.from || entity
              .flatMap(_.replyCount)
              .forall(_ < r.to) || b.items.size != r.to - r.from + 1
          ),
          b.id + ".replyRange",
          "回复范围须匹配展示条数且不超过实体回复总数"
        )
      ).flatten
    }
    own ++ fields ++ refs
