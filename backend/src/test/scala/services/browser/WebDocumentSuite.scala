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
