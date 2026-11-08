package services.browser
import munit.FunSuite
import java.nio.file.{Files, Paths}
import io.circe.parser.decode
import services.browser.objects.*
import services.browser.utils.WebDocuments
class WebDocumentSuite extends FunSuite:
  private def fixture(name: String): WebDocument = decode[WebDocument](
    Files.readString(Paths.get("../contracts/web-documents/" + name + ".json"))
  ).toOption.get
  List("forum", "shop", "docs").foreach { name =>
    test("v3 layout contract: " + name) {
      assert(WebDocuments.prepare(fixture(name), "https://sample.example/").isRight)
    }
  }
  test("CSS math retains responsive container declarations") {
    val doc = fixture("docs").copy(
      css = ".wrap{width:min(1120px,100% - 2.5rem);margin-inline:auto}"
    )
    val css = WebDocuments.prepare(doc, "https://sample.example/").toOption.get.css
    assert(css.contains("1120px"), css)
    assert(css.contains("2.5rem"), css)
    assert(css.contains("margin-inline:auto"), css)
  }
  test("CSS math compatibility respects nested functions, comments and strings") {
    val source = "/* min(1px,2px - 1px) */\r\n\tp::before{content:'max(1,2 - 1)'}\r\n" +
      "p{width:clamp(10px,min(80vw,100% - 2rem) + 1px,1200px);height:min(var(--range),10px)}"
    val prepared = services.browser.utils.CssMathCompatibility.prepare(source)
    assert(prepared.contains("/* min(1px,2px - 1px) */"), prepared)
    assert(prepared.contains("content:'max(1,2 - 1)'"), prepared)
    assert(prepared.contains("min(var(--range),10px)"), prepared)
    val result = WebDocuments.prepare(fixture("docs").copy(css = source), "https://sample.example/")
    assert(result.isRight, result.toString)
    val css = result.toOption.get.css
    assert(css.contains("1200px") && css.contains("2rem") && css.contains("1px"), css)
    assert(
      WebDocuments
        .prepare(
          fixture("docs")
            .copy(css = "p{width:min(100%,20px + 1px);background:url(https://example.com/x)}"),
          "https://sample.example/"
        )
        .isLeft
    )
  }
  test("text figures retain captions and CSS layout without allowing external media") {
    val base = fixture("docs")
    val figure =
      "<figure id='diagram'><blockquote cite='https://sample.example/walk'>海岸 ── 街巷</blockquote><figcaption>晚间散步路线</figcaption></figure>"
    val doc = base.copy(
      html = base.html + figure,
      css =
        base.css + "figure{display:grid;grid-template-columns:1fr 1fr}figcaption{font-style:italic}"
    )
    val result = WebDocuments.prepare(doc, "https://sample.example/").toOption.get
    assert(result.html.contains("<figure id=\"diagram\">"))
    assertEquals(
      org.jsoup.Jsoup
        .parseBodyFragment(result.html)
        .selectFirst("figure#diagram > figcaption")
        .text(),
      "晚间散步路线"
    )
    for content <- List(
        "<img src='https://example.com/a.png'>",
        "<script>alert(1)</script>",
        "<iframe src='https://example.com'></iframe>"
      )
    do
      assert(
        WebDocuments
          .prepare(
            base.copy(html = "<figure>" + content + "<figcaption>说明</figcaption></figure>"),
            "https://sample.example/"
          )
          .isLeft
      )
  }
  test(
    "Copy requires a real text region and transient feedback; Set cannot promise clipboard success"
  ) {
    val base = fixture("docs")
    val copy = WebAction(
      "copy",
      WebActionKind.Copy,
      "copy-button",
      region = Some("copy-text"),
      stateKey = Some("copy-status")
    )
    val doc = base.copy(
      html =
        base.html + "<p id='copy-text'>可以复制的内容</p><button id='copy-button'>复制</button><output data-state='copy-status'></output>",
      actions = base.actions :+ copy,
      initialState = base.initialState + ("copy-status" -> "")
    )
    assert(WebDocuments.prepare(doc, "https://sample.example/").isRight)
    List(
      copy.copy(region = None),
      copy.copy(region = Some("missing")),
      copy.copy(stateKey = None),
      copy.copy(kind = WebActionKind.Set, value = Some("已复制"))
    ).foreach { invalid =>
      assert(
        WebDocuments
          .prepare(doc.copy(actions = base.actions :+ invalid), "https://sample.example/")
          .isLeft
      )
    }
    assert(
      WebDocuments
        .prepare(
          doc.copy(persistentKeys = doc.persistentKeys :+ "copy-status"),
          "https://sample.example/"
        )
        .isLeft
    )
  }
  test("reject executable content, resource CSS, duplicated IDs and missing action targets") {
    val base = fixture("forum")
    List(
      base.copy(html = base.html + "<script>alert(1)</script>"),
      base.copy(html = base.html + "<div onclick='evil()'>x</div>"),
      base.copy(css = "body{background:url(https://evil.example/x)}"),
      base.copy(html = base.html + "<p id='posts'>duplicate</p>"),
      base.copy(html = base.html + "<iframe></iframe>"),
      base.copy(actions = base.actions.map(_.copy(elementId = "absent"))),
      base.copy(html = "<div>" * 30 + "x" + "</div>" * 30),
      base.copy(css = "x" * 120001)
    ).foreach(d => assert(WebDocuments.prepare(d, "https://sample.example/").isLeft))
  }

  test("document budgets, entity references and safe typographic markup") {
    val base = fixture("forum")
    assert(
      WebDocuments
        .prepare(
          base.copy(html = base.html + "<p><mark>搜索词</mark><kbd>Enter</kbd><sup>2</sup></p>"),
          "https://sample.example/"
        )
        .isRight
    )
    List(
      base.copy(html = base.html + "<span>x</span>" * 2001),
      base.copy(actions = List.fill(65)(base.actions.head)),
      base.copy(bindings =
        List(WebBinding("thread", "https://sample.example/missing", EntityField.Title))
      ),
      base.copy(subjectEntityId = Some("https://sample.example/missing")),
      base.copy(css = "@import 'https://example.com/a.css';"),
      base.copy(html = base.html + "<img src='https://example.com/x'>")
    ).foreach(d => assert(WebDocuments.prepare(d, "https://sample.example/").isLeft))
  }
