package services.generation
import munit.FunSuite
import io.circe.parser.decode
import java.nio.file.{Files, Paths}
import services.browser.objects.WebDocument
import services.generation.utils.DesignPreservation

/** Regression coverage for content-preserving refinements and scoped trigger repair. */
class DesignPreservationSuite extends FunSuite:
  private val base = decode[WebDocument](
    Files.readString(Paths.get("../contracts/web-documents/docs.json"))
  ).toOption.get
  test("deleted prose cannot be replaced by navigation labels or a single duplicate") {
    val paragraph = "这段正文包含重要的详细介绍，必须完整保留给读者阅读。"
    val before = base.copy(html = s"<main><p>$paragraph</p><p>$paragraph</p></main>")
    val missing = before.copy(html = s"<main><p>$paragraph</p></main>")
    val navigation = before.copy(html = s"<nav>$paragraph$paragraph</nav>")
    assert(DesignPreservation.issues(before, missing).exists(_.contains("正文覆盖不足")))
    assert(DesignPreservation.issues(before, navigation).exists(_.contains("正文覆盖不足")))
  }
  test("splitting unchanged readable text into inline nodes is accepted") {
    val before = base.copy(html = "<main><p>这是一段完全相同的正文，重新排版不应视为删除内容。</p></main>")
    val after =
      before.copy(html = "<main><p><span>这是一段完全相同的正文，</span><span>重新排版不应视为删除内容。</span></p></main>")
    assertEquals(
      org.jsoup.Jsoup.parse(before.html).text(),
      org.jsoup.Jsoup.parse(after.html).text()
    )
    assertEquals(DesignPreservation.issues(before, after), Nil)
  }
  test("only reviewed invalid triggers can be repaired without changing action intent") {
    val action = base.actions.find(_.kind.toString == "Toggle").get
    val broken = base.copy(actions =
      base.actions.map(a => if a.id == action.id then a.copy(elementId = action.region.get) else a)
    )
    assert(DesignPreservation.issues(broken, base).exists(_.contains("动作功能变化")))
    assertEquals(DesignPreservation.issues(broken, base, Set(action.id)), Nil)
    val retargeted = base.copy(actions =
      base.actions.map(a => if a.id == action.id then a.copy(region = Some("other")) else a)
    )
    assert(DesignPreservation.issues(broken, retargeted, Set(action.id)).nonEmpty)
  }
