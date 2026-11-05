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
