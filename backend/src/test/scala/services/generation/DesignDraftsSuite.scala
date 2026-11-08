package services.generation
import munit.FunSuite
import io.circe.syntax.*
import services.browser.objects.SiteStyle
import services.generation.objects.*
import services.generation.utils.{DesignDrafts, DesignPreservation}

class DesignDraftsSuite extends FunSuite:
  private val draft = DesignDraft(
    "文章",
    "描述",
    "<main><p>完整正文有自己的阅读顺序与信息。</p></main>",
    "main{display:grid}",
    SiteStyle("品牌", "字体", "颜色", "布局")
  )
  test("draft budget rejects complete over-limit objects without truncating content") {
    DesignDrafts.check(draft)
    assertEquals(draft.asJson.as[DesignDraft], Right(draft))
    intercept[IllegalArgumentException](DesignDrafts.check(draft.copy(html = "x" * 120001)))
    intercept[IllegalArgumentException](DesignDrafts.check(draft.copy(html = "<p>x</p>" * 2001)))
    intercept[IllegalArgumentException](
      DesignDrafts.check(draft.copy(html = "<div>" * 25 + "x" + "</div>" * 25))
    )
    assert(
      DesignPreservation.preservesProse(
        draft.html,
        "<main><p>完整正文有自己的<span>阅读顺序</span>与信息。</p></main>"
      )
    )
    assert(!DesignPreservation.preservesProse(draft.html, "<main><p>删减后的文章。</p></main>"))
  }
  test("assembly can share duplicated draft text without dropping distinct prose") {
    val first = "这段文案完整展示在列表中，点击复制时仍然取得同一份内容，不需要额外隐藏一份副本。"
    val second = "另一条文案讲述不同的事情，也需要完整保留；不能用重复第一条的方式代替这一条。"
    val draftHtml =
      s"<main><p>$first</p><p class='visually-hidden'>$first</p><p>$second</p></main>"
    assert(
      DesignPreservation.preservesProse(draftHtml, s"<main><p>$first</p><p>$second</p></main>")
    )
    assert(
      !DesignPreservation.preservesProse(draftHtml, s"<main><p>$first</p><p>$first</p></main>")
    )
  }
  test("historical workflow and guidance do not silently opt into draft planning") {
    val old = DesignWorkflow("8-old").asJson.mapObject(_.remove("draftPlanning").remove("draft"))
    assertEquals(old.as[DesignWorkflow].toOption.get.draft, None)
    assertEquals(old.as[DesignWorkflow].toOption.get.draftPlanning, None)
    val guidance =
      DesignGuidanceText("8-old", "design", "review").asJson.mapObject(_.remove("draftPlanning"))
    assertEquals(guidance.as[DesignGuidanceText].toOption.get.draftPlanning, false)
  }
