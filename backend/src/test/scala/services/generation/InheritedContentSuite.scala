package services.generation
import munit.FunSuite
import services.browser.objects.*
import services.generation.objects.JobId
import services.generation.utils.{InheritedContent, PromptBuilder}
import io.circe.parser.parse

class InheritedContentSuite extends FunSuite:
  private val address = "https://forum.example/t/84458"
  private val entity = PageEntity(
    address,
    EntityKind.Thread,
    Some("原始标题"),
    Some("原始摘要"),
    Some("小林"),
    Some("2026-11-03"),
    Some(37)
  )
  private val context = NavigationContext(
    address,
    NavigationItem("clicked", BlockType.Thread, address, entity.title, entity.summary, None),
    Nil,
    None,
    List(entity),
    Nil
  )
  private val page = PageRecord(
    PageId("page"),
    address,
    PageKind.Website,
    address,
    PageStatus.Generating,
    None,
    JobId("job"),
    None,
    None,
    "pending",
    Some(context)
  )
  private val block =
    PageBlock("body", BlockType.Article, None, Some("展开的正文"), None, Nil, entityId = Some(address))
  private val spec = PageSpec(2, "详情", "详情摘要", Theme.Paper, List(block))

  test("missing entity and fields inherit; expanded body is independent of canonical summary") {
    val result = InheritedContent.prepare(spec, page).toOption.get
    assertEquals(result.entities, List(entity))
    assertEquals(result.subjectEntityId, Some(address))
    assertEquals(result.blocks.head.text, Some("展开的正文"))
    val sparse = entity.copy(
      title = None,
      summary = None,
      author = None,
      publishedAt = None,
      replyCount = None
    )
    assertEquals(
      InheritedContent.prepare(spec.copy(entities = List(sparse)), page).toOption.get.entities,
      List(entity)
    )
  }
  test("explicit title, reply count, author and subject conflicts remain repairable errors") {
    List(
      entity.copy(title = Some("改写标题")),
      entity.copy(replyCount = Some(2)),
      entity.copy(author = Some("陌生人"))
    )
      .foreach(changed =>
        assertEquals(
          InheritedContent
            .prepare(spec.copy(entities = List(changed)), page)
            .left
            .toOption
            .get
            .code,
          "invalid_content"
        )
      )
    assert(
      InheritedContent
        .prepare(spec.copy(subjectEntityId = Some("https://other.example/")), page)
        .isLeft
    )
    assert(InheritedContent.prepare(spec.copy(schemaVersion = 1), page).isLeft)
  }
  test("structured prompt carries saved snapshot without source JSON substring truncation") {
    val prompt = PromptBuilder.request(page)
    val json = parse(prompt.substring(prompt.indexOf('\n') + 1)).toOption.get
    assertEquals(
      json.hcursor.downField("navigationContext").downField("selected").get[String]("blockId"),
      Right("clicked")
    )
    assert(prompt.contains("37"))
  }
