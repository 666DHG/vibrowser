package services.generation
import munit.FunSuite
import java.nio.file.{Files, Paths}
import io.circe.parser.parse
import io.circe.syntax.*
import services.generation.utils.WebDocumentDecoder
class WebDocumentDecoderSuite extends FunSuite:
  test("provider scalar shorthand is normalized without accepting objects") {
    val json =
      parse(Files.readString(Paths.get("../contracts/web-documents/shop.json"))).toOption.get
    val numeric =
      json.mapObject(_.add("initialState", io.circe.Json.obj("cart" -> io.circe.Json.fromInt(0))))
    assertEquals(WebDocumentDecoder.decode(numeric.noSpaces).toOption.get.initialState("cart"), "0")
    val invalid =
      json.mapObject(_.add("initialState", io.circe.Json.obj("cart" -> io.circe.Json.obj())))
    assert(WebDocumentDecoder.decode(invalid.noSpaces).isLeft)
  }

  test("region append keeps the parent document and bindings") {
    val base = io.circe.parser
      .decode[services.browser.objects.WebDocument](
        Files.readString(Paths.get("../contracts/web-documents/forum.json"))
      )
      .toOption
      .get
    val action = base.actions.find(_.kind == services.browser.objects.WebActionKind.Append).get
    val snapshot = services.browser.objects.PageActionSnapshot(
      "r",
      services.browser.objects.PageId("source"),
      services.browser.objects.PageId("result"),
      action,
      Map.empty,
      "revision",
      base
    )
    val patch = base.copy(
      html = "<article id='new-post'>新帖子</article>",
      actions = Nil,
      bindings = Nil,
      entities = Nil,
      css = ""
    )
    val result =
      services.generation.utils.WebActionResults.combine(patch, Some(snapshot)).toOption.get
    assert(result.html.contains("new-post"))
    assert(result.html.contains("选课系统"))
    assertEquals(result.css, base.css)
  }

  test("producer-only empty metadata and enum casing normalize; unknown actions still fail") {
    val json =
      parse(Files.readString(Paths.get("../contracts/web-documents/shop.json"))).toOption.get
    val loose = json.mapObject(
      _.remove("bindings").remove("persistentKeys").add("actions", io.circe.Json.arr())
    )
    assert(WebDocumentDecoder.decode("```json\n" + loose.noSpaces + "\n```").isRight)
    val bad = json.mapObject(
      _.add(
        "actions",
        io.circe.Json.arr(
          io.circe.Json.obj(
            "id" -> io.circe.Json.fromString("x"),
            "kind" -> io.circe.Json.fromString("Execute"),
            "elementId" -> io.circe.Json.fromString("x")
          )
        )
      )
    )
    assert(WebDocumentDecoder.decode(bad.noSpaces).isLeft)
  }
