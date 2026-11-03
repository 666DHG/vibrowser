package services.browser
import munit.FunSuite
import java.nio.file.{Files,Paths}
import scala.jdk.CollectionConverters.*
import io.circe.parser.decode
import io.circe.syntax.*
import services.browser.objects.*
import services.browser.utils.*
class ContractSuite extends FunSuite:
  List("valid","invalid").foreach { kind =>
    val dir = Paths.get("../contracts/fixtures",kind)
    val stream = Files.list(dir)
    val paths = stream.iterator().asScala.toList
    stream.close()
    paths.foreach { path =>
      test(kind + ": " + path.getFileName.toString) {
        val decoded = decode[PageSpec](Files.readString(path))
        val valid = decoded.exists(p => PageValidation.validate(p,"https://moon-coffee.example/").isEmpty)
        assertEquals(valid,kind == "valid")
        if valid then assertEquals(decoded.flatMap(p => decode[PageSpec](p.asJson.noSpaces)),decoded)
      }
    }
  }
  test("address detection, normalization and search") {
    assertEquals(AddressRules.classify("xx.com",None).map(_.canonical),Right("https://xx.com/"))
    assertEquals(AddressRules.classify("https://XX.com:443/menu?q=1#x",None).map(_.canonical),Right("https://xx.com/menu?q=1"))
    assertEquals(AddressRules.classify("月球旅行",None).map(_.kind),Right(PageKind.Search))
    assertEquals(AddressRules.classify("/menu",Some("https://x.example/")).map(_.canonical),Right("https://x.example/menu"))
    List("","file:///x","javascript:alert(1)","http://127.0.0.1","https://user:pass@x.com").foreach(s => assert(AddressRules.classify(s,None).isLeft))
  }
