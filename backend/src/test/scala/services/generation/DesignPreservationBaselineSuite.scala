package services.generation
import munit.FunSuite
import io.circe.parser.decode
import java.nio.file.{Files, Paths}
import services.browser.objects.WebDocument
import services.generation.utils.DesignPreservation

/** Characterization of known false positives. Replace with acceptance assertions when fixed. */
class DesignPreservationBaselineSuite extends FunSuite:
  private val base = decode[WebDocument](
    Files.readString(Paths.get("../contracts/web-documents/docs.json"))
  ).toOption.get
  test("baseline: splitting unchanged readable text into inline nodes is rejected") {
    val before = base.copy(html = "<main><p>这是一段完全相同的正文，重新排版不应视为删除内容。</p></main>")
    val after =
      before.copy(html = "<main><p><span>这是一段完全相同的正文，</span><span>重新排版不应视为删除内容。</span></p></main>")
    assertEquals(
      org.jsoup.Jsoup.parse(before.html).text(),
      org.jsoup.Jsoup.parse(after.html).text()
    )
    assert(DesignPreservation.issues(before, after).exists(_.contains("正文覆盖不足")))
  }
  test("baseline: repairing an action trigger while preserving its identity is rejected") {
    val action = base.actions.find(_.kind.toString == "Toggle").get
    val broken = base.copy(actions =
      base.actions.map(a => if a.id == action.id then a.copy(elementId = action.region.get) else a)
    )
    assert(DesignPreservation.issues(broken, base).exists(_.contains("动作功能变化")))
  }
