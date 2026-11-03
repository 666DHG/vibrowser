package services.browser
import munit.FunSuite
import io.circe.syntax.*
import io.circe.parser.decode
import services.browser.objects.*
import services.browser.utils.NavigationContexts
import services.generation.objects.JobId

class NavigationContextSuite extends FunSuite:
  private val base = "https://forum.example/"
  private val target = base + "t/84458"
  private def item(id: String, title: String, link: String = "/t/84458") =
    PageBlock(
      id,
      BlockType.Thread,
      Some(title),
      Some("完整条目正文"),
      Some(link),
      Nil,
      Some("匿名 · 37 回复")
    )
  private def page(
      spec: PageSpec,
      address: String = base,
      context: Option[NavigationContext] = None
  ) =
    PageRecord(
      PageId(address),
      address,
      PageKind.Website,
      address,
      PageStatus.Ready,
      Some(spec),
      JobId("j"),
      None,
      None,
      "mock",
      context
    )
  private val spec =
    PageSpec(1, "树洞", "社区", Theme.Paper, List(item("first", "第一处"), item("chosen", "选中的帖子")))
  private def capture(source: PageRecord, id: String, url: String = target) =
    NavigationContexts.capture(Some(source), Some(id), url).toOption.get.get

  test("block identity selects the clicked duplicate URL and legacy facts remain verbatim") {
    val context = capture(page(spec), "chosen")
    assertEquals(context.selected.title, Some("选中的帖子"))
    assertEquals(context.selected.text, Some("完整条目正文"))
    assertEquals(context.entities.head.legacyMeta, Some("匿名 · 37 回复"))
    assertEquals(context.entities.head.replyCount, None)
    assertEquals(context.entities.head.author, None)
    assert(NavigationContexts.capture(Some(page(spec)), Some("chosen"), base + "wrong").isLeft)
    assert(NavigationContexts.capture(Some(page(spec)), Some("absent"), target).isLeft)
    assertEquals(NavigationContexts.capture(Some(page(spec)), None, target), Right(None))
  }
  test(
    "large source prioritizes selected entity and truncates whole context entries within budget"
  ) {
    val entities = (1 to 40).toList.map(i =>
      PageEntity(base + "t/" + i, EntityKind.Thread, Some("帖子" + i), Some("字" * 6000))
    )
    val selected = item("last", "末尾条目", "/t/40").copy(entityId = Some(base + "t/40"))
    val source = spec.copy(
      schemaVersion = 2,
      entities = entities,
      blocks = List.fill(35)(item("padding", "填充").copy(text = Some("字" * 6000))) :+ selected
    )
    val context = capture(page(source), "last", base + "t/40")
    assertEquals(context.entities.head.id, base + "t/40")
    assertEquals(context.selected.text, Some("字" * 6000))
    assert(context.asJson.noSpaces.length <= 24000)
    assertEquals(decode[NavigationContext](context.asJson.noSpaces), Right(context))
  }
  test(
    "three recent ancestor summaries survive chained clicks; cross-site strips identity and facts"
  ) {
    val last = (1 to 5).foldLeft(page(spec)) { (source, i) =>
      val context = capture(source, "chosen")
      page(spec.copy(title = "第" + i + "页"), base + "level/" + i, Some(context))
    }
    val context = capture(last, "chosen")
    assertEquals(context.ancestors.map(_.title), List("第3页", "第4页", "第5页"))
    val external = spec.copy(blocks = List(item("out", "目的地说明", "https://other.example/")))
    val out = capture(page(external, context = Some(context)), "out", "https://other.example/")
    assertEquals(out.selected.title, Some("目的地说明"))
    assertEquals(out.entities, Nil)
    assertEquals(out.ancestors, Nil)
    assertEquals(out.containers, Nil)
    assertEquals(out.appearance, None)
  }
