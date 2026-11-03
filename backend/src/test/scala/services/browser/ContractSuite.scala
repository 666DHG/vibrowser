package services.browser
import munit.FunSuite
import java.nio.file.{Files, Paths}
import scala.jdk.CollectionConverters.*
import io.circe.parser.decode
import io.circe.syntax.*
import services.browser.objects.*
import services.browser.utils.*
class ContractSuite extends FunSuite:
  List("valid", "invalid").foreach { kind =>
    val dir = Paths.get("../contracts/fixtures", kind)
    val stream = Files.list(dir)
    val paths = stream.iterator().asScala.toList
    stream.close()
    paths.foreach { path =>
      test(kind + ": " + path.getFileName.toString) {
        val decoded = decode[PageSpec](Files.readString(path))
        val valid =
          decoded.exists(p => PageValidation.validate(p, "https://moon-coffee.example/").isEmpty)
        assertEquals(valid, kind == "valid")
        if valid then
          assertEquals(decoded.flatMap(p => decode[PageSpec](p.asJson.noSpaces)), decoded)
      }
    }
  }
  test("address detection, normalization and search") {
    assertEquals(AddressRules.classify("xx.com", None).map(_.canonical), Right("https://xx.com/"))
    assertEquals(
      AddressRules.classify("xx.com/menu", None).map(_.canonical),
      Right("https://xx.com/menu")
    )
    assertEquals(
      AddressRules.classify("xx.com:8080/menu", None).map(_.canonical),
      Right("https://xx.com:8080/menu")
    )
    List("xx.com:abc", "xx.com:65536", "https://bad_host.example").foreach(s =>
      assert(AddressRules.classify(s, None).isLeft)
    )
    assertEquals(
      AddressRules.classify("https://XX.com:443/menu?q=1#x", None).map(_.canonical),
      Right("https://xx.com/menu?q=1")
    )
    assertEquals(
      AddressRules.classify("https://forum.example/a/../t/夜航", None).map(_.canonical),
      Right("https://forum.example/t/%E5%A4%9C%E8%88%AA")
    )
    assertEquals(AddressRules.classify("月球旅行", None).map(_.kind), Right(PageKind.Search))
    assertEquals(
      AddressRules.classify("/menu", Some("https://x.example/")).map(_.canonical),
      Right("https://x.example/menu")
    )
    List("", "file:///x", "javascript:alert(1)", "http://127.0.0.1", "https://user:pass@x.com")
      .foreach(s => assert(AddressRules.classify(s, None).isLeft))
  }

  test("internationalized inputs keep their meaning while sharing a canonical cache identity") {
    val chinese = AddressRules.classify(" 清华树洞.com/热门?q=夜聊+咖啡 ", None).toOption.get
    assertEquals(chinese.prompt, "清华树洞.com/热门?q=夜聊+咖啡")
    assert(chinese.canonical.startsWith("https://xn--xkr069b3udl0a.com/"))
    assert(chinese.canonical.contains("%E7%83%AD%E9%97%A8"))
    assertEquals(
      AddressRules.classify(chinese.canonical, None).toOption.get.canonical,
      chinese.canonical
    )
    val relative = AddressRules.classify("/热门", Some("https://forum.example/")).toOption.get
    assertEquals(relative.prompt, "/热门")
    assertEquals(
      AddressRules.classify("https://EXAMPLE.com/topic", None).toOption.get.prompt,
      "https://EXAMPLE.com/topic"
    )
  }
  test("search results require absolute destinations and mismatch repairs receive both addresses") {
    val entity = PageEntity("https://rhymes.example/song", EntityKind.Page, Some("童谣"), None)
    val block = PageBlock(
      "r1",
      BlockType.Card,
      Some("童谣"),
      Some("查询结果"),
      Some(entity.id),
      Nil,
      entityId = Some(entity.id)
    )
    val page = PageSpec(2, "搜索", "结果", Theme.Paper, List(block), entities = List(entity))
    val base = "vibe://search?q=童谣"
    assertEquals(PageValidation.validate(page, base), Nil)
    val invalid =
      PageValidation.validate(page.copy(blocks = List(block.copy(target = Some("/song")))), base)
    assert(invalid.exists(_.message.contains("绝对HTTP(S)")))
    assert(invalid.exists(_.message.contains("https://rhymes.example/song")))
    assert(invalid.exists(_.message.contains("target=/song")))
  }
