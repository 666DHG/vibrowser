package services.generation
import munit.FunSuite
import io.circe.parser.parse
import services.browser.objects.*
import services.generation.objects.JobId
import services.generation.utils.{GenerationTargets, PromptBuilder}

class GenerationTargetsSuite extends FunSuite:
  private def record(address: String, input: String, kind: PageKind = PageKind.Website) =
    PageRecord(
      PageId("p"),
      address,
      kind,
      input,
      PageStatus.Generating,
      None,
      JobId("j"),
      None,
      None,
      "pending"
    )
  test("model sees Chinese host and decoded path even for a legacy encoded-only record") {
    val address = "https://xn--xkr069b3udl0a.com:8443/%E7%83%AD%E9%97%A8?q=%E5%A4%9C%E8%81%8A+x"
    val page = record(address, address)
    val target = GenerationTargets.describe(page)
    assertEquals(target.host, Some("清华树洞.com"))
    assertEquals(target.path, Some("/热门"))
    assertEquals(target.query, Some("q=夜聊+x"))
    assertEquals(target.readableAddress, "https://清华树洞.com:8443/热门?q=夜聊+x")
    assertEquals(target.address, address)
    val json = parse(PromptBuilder.request(page).linesIterator.drop(1).mkString).toOption.get
    assertEquals(json.hcursor.downField("target").get[String]("host"), Right("清华树洞.com"))
    assert(PromptBuilder.request(page).contains("清华树洞.com"))
  }
  test("original input and search intent are distinct from transport encoding") {
    val page = record("vibe://search?q=encoded", "一二三四五上山打老虎", PageKind.Search)
    val target = GenerationTargets.describe(page)
    assertEquals(target.input, "一二三四五上山打老虎")
    assertEquals(target.query, Some(target.input))
    assertEquals(target.host, None)
    val prompt = PromptBuilder.request(page)
    assert(prompt.contains("跨网站搜索结果页"))
    assert(prompt.contains("一二三四五上山打老虎"))
    val english = GenerationTargets.describe(record("https://docs.example/api", "docs.example/api"))
    assertEquals(english.host, Some("docs.example"))
    assertEquals(english.input, "docs.example/api")
  }
