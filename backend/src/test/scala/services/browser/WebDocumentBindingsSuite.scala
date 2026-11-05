package services.browser
import cats.effect.IO
import munit.CatsEffectSuite
import io.circe.parser.decode
import java.nio.file.{Files, Paths}
import services.browser.objects.*
import services.browser.api.{NormalizeWebDocumentMessage, ValidateWebDocumentMessage}

class WebDocumentBindingsSuite extends CatsEffectSuite:
  private val fixture = decode[WebDocument](
    Files.readString(Paths.get("../contracts/web-documents/forum.json"))
  ).toOption.get
  private val entity = PageEntity(
    "https://site.example/topic",
    EntityKind.Thread,
    Some("唯一的帖子标题"),
    Some("摘要"),
    Some("小林"),
    None,
    Some(37),
    None,
    None
  )
  private val base = fixture.copy(
    html = "",
    css = "",
    actions = Nil,
    entities = List(entity),
    bindings = Nil,
    subjectEntityId = None
  )
  private def normalize(doc: WebDocument): IO[WebDocument] =
    NormalizeWebDocumentMessage(doc, "https://site.example/").plan(null)
  test("inline binding preserves layout and assigns collision-free IDs with canonical facts") {
    for
      doc <- normalize(
        base.copy(html =
          """<span id="vib-entity-0">标识已占用</span><h2><a href="/topic"><span data-entity-id="/topic" data-entity-field="title">模型临时标题</span></a></h2>"""
        )
      )
      _ = assertEquals(doc.bindings.size, 1)
      _ = assertEquals(doc.bindings.head.entityId, entity.id)
      _ = assertNotEquals(doc.bindings.head.elementId, "vib-entity-0")
      ready <- ValidateWebDocumentMessage(doc, "https://site.example/").plan(null)
      _ = assert(ready.html.contains("唯一的帖子标题"))
      _ = assert(ready.html.contains("<a "))
      _ = assert(!ready.html.contains("模型临时标题"))
    yield ()
  }
  test("orphan binding reconnects only to one exact visible text leaf") {
    val binding = WebBinding("absent-title", entity.id, EntityField.Title)
    for
      fixed <- normalize(base.copy(html = "<h1>唯一的帖子标题</h1>", bindings = List(binding)))
      _ <- ValidateWebDocumentMessage(fixed, "https://site.example/").plan(null)
      ambiguous <- normalize(
        base.copy(html = "<h1>唯一的帖子标题</h1><p>唯一的帖子标题</p>", bindings = List(binding))
      )
      failed <- ValidateWebDocumentMessage(ambiguous, "https://site.example/").plan(null).attempt
      _ = assert(failed.isLeft)
      _ = assert(failed.swap.toOption.get.getMessage.contains("absent-title"))
      _ = assert(failed.swap.toOption.get.getMessage.contains("bindings[0]"))
    yield ()
  }
  test(
    "diagnostics include every broken reference without deleting fields or weakening validation"
  ) {
    for
      doc <- normalize(
        base.copy(
          html = "<p id='content'>正文</p>",
          bindings = List(
            WebBinding("title-missing", entity.id, EntityField.Title),
            WebBinding("author-missing", entity.id, EntityField.Author)
          )
        )
      )
      result <- ValidateWebDocumentMessage(doc, "https://site.example/").plan(null).attempt
      message = result.swap.toOption.get.getMessage
      _ = assert(
        message.contains("title-missing") && message.contains("author-missing") && message.contains(
          "content"
        )
      )
      unsafe <- normalize(
        base.copy(html =
          """<script>alert(1)</script><h1 data-entity-id="/topic" data-entity-field="Title">标题</h1>"""
        )
      )
      rejected <- ValidateWebDocumentMessage(unsafe, "https://site.example/").plan(null).attempt
      _ = assert(rejected.isLeft)
      unknown <- normalize(
        base.copy(html = """<h1 data-entity-id="/topic" data-entity-field="MadeUp">标题</h1>""")
      ).attempt
      _ = assert(unknown.isLeft)
    yield ()
  }

  test(
    "host-bound forms accept ordinary action and method attributes without external submission"
  ) {
    val search = WebAction("search", WebActionKind.Search, "search-form")
    for
      normalized <- normalize(
        base.copy(
          html =
            """<form id="search-form" action="/search" method="get"><input name="q" required><button type="submit">搜索</button></form>""",
          actions = List(search)
        )
      )
      ready <- ValidateWebDocumentMessage(normalized, "https://site.example/").plan(null)
      _ = assert(!ready.html.contains("action="))
      _ = assert(!ready.html.contains("method="))
      _ = assertEquals(ready.actions, List(search))
      unsafe <- normalize(
        base.copy(
          html =
            """<form id="search-form" action="/search" method="get" onsubmit="alert(1)"><input name="q"></form>""",
          actions = List(search)
        )
      )
      rejected <- ValidateWebDocumentMessage(unsafe, "https://site.example/").plan(null).attempt
      _ = assert(rejected.isLeft)
    yield ()
  }

  test("an explicit data-action-id marker reconnects its single action without guessing") {
    val action = WebAction("act-search", WebActionKind.Search, "missing-form")
    for
      normalized <- normalize(
        base.copy(
          html =
            """<form data-action-id="act-search"><input name="q" required><button type="submit">搜索</button></form>""",
          actions = List(action)
        )
      )
      _ <- ValidateWebDocumentMessage(normalized, "https://site.example/").plan(null)
      _ = assert(normalized.html.contains("id=\"missing-form\""))
      ambiguous <- normalize(
        base.copy(
          html =
            """<form data-action-id="act-search"></form><form data-action-id="act-search"></form>""",
          actions = List(action)
        )
      )
      rejected <- ValidateWebDocumentMessage(ambiguous, "https://site.example/").plan(null).attempt
      _ = assert(rejected.isLeft)
    yield ()
  }

  test(
    "contact addresses remain visible while unsafe navigation remains rejected with its target"
  ) {
    for
      normalized <- normalize(
        base.copy(
          html =
            """<a href="mailto:author@example.com" id="mail">联系作者 author@example.com</a><a href="tel:+123">+123</a>""",
          actions = List(
            WebAction(
              "mail",
              WebActionKind.Navigate,
              "mail",
              target = Some("mailto:author@example.com")
            )
          )
        )
      )
      ready <- ValidateWebDocumentMessage(normalized, "https://site.example/").plan(null)
      _ = assert(ready.html.contains("author@example.com") && ready.html.contains("+123"))
      _ = assert(ready.actions.isEmpty)
      unsafe <- normalize(base.copy(html = """<a href="javascript:alert(1)">危险链接</a>"""))
      result <- ValidateWebDocumentMessage(unsafe, "https://site.example/").plan(null).attempt
      _ = assert(result.swap.toOption.get.getMessage.contains("javascript:alert(1)"))
    yield ()
  }
