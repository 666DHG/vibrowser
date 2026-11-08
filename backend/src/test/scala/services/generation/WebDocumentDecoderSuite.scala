package services.generation
import munit.CatsEffectSuite
import java.nio.file.{Files, Paths}
import io.circe.parser.parse
import io.circe.syntax.*
import services.generation.utils.WebDocumentDecoder
import services.browser.objects.*
import services.browser.api.ValidateWebDocumentMessage
class WebDocumentDecoderSuite extends CatsEffectSuite:
  test("structured style descriptions are lossless metadata, not a reason to regenerate content") {
    val base = io.circe.parser
      .decode[WebDocument](Files.readString(Paths.get("../contracts/web-documents/docs.json")))
      .toOption
      .get
    val palette = io.circe.Json.obj("background" -> "#fbf8f4".asJson, "accent" -> "#c8102e".asJson)
    val typography = List("中文衬线", "等宽代码").asJson
    val structured = base.asJson.mapObject(
      _.add(
        "siteStyle",
        base.siteStyle.asJson.mapObject(
          _.add("palette", palette).add("typography", typography)
        )
      )
    )
    val result = WebDocumentDecoder.decode(structured.noSpaces).toOption.get
    assertEquals(parse(result.siteStyle.palette), Right(palette))
    assertEquals(parse(result.siteStyle.typography), Right(typography))
    assertEquals(result.copy(siteStyle = base.siteStyle), base)
    assertEquals(WebDocumentDecoder.decode(result.asJson.noSpaces), Right(result))
    val invalidBrand = structured.mapObject(
      _.add(
        "siteStyle",
        structured.hcursor.downField("siteStyle").focus.get.mapObject(_.add("brand", palette))
      )
    )
    assert(WebDocumentDecoder.decode(invalidBrand.noSpaces).isLeft)
    ValidateWebDocumentMessage(result, "https://sample.example/")
      .plan(null)
      .map(valid => assertEquals(valid.siteStyle, result.siteStyle))
  }
  test("missing copy feedback initializes transient state without altering page content") {
    val base = io.circe.parser
      .decode[WebDocument](Files.readString(Paths.get("../contracts/web-documents/docs.json")))
      .toOption
      .get
    val action = WebAction(
      "copy-test",
      WebActionKind.Copy,
      "copy-test",
      region = Some("copy-content"),
      stateKey = Some("feedback")
    )
    val original = base.copy(
      html =
        base.html + "<p id='copy-content'>完整原文</p><button id='copy-test'>复制</button><output data-state='feedback'></output>",
      actions = base.actions :+ action
    )
    val result = WebDocumentDecoder.decode(original.asJson.noSpaces).toOption.get
    assertEquals(result.initialState, original.initialState + ("feedback" -> ""))
    assertEquals(result.copy(initialState = original.initialState), original)
    assertEquals(WebDocumentDecoder.decode(result.asJson.noSpaces), Right(result))
    ValidateWebDocumentMessage(result, "https://sample.example/")
      .plan(null)
      .map(valid => assertEquals(valid.initialState("feedback"), ""))
  }
  test("copy feedback normalization does not invent business state or persistent values") {
    val base = io.circe.parser
      .decode[WebDocument](Files.readString(Paths.get("../contracts/web-documents/docs.json")))
      .toOption
      .get
    val copy = WebAction(
      "copy",
      WebActionKind.Copy,
      "copy",
      region = Some("text"),
      stateKey = Some("shared")
    )
    val increment =
      WebAction("add", WebActionKind.Increment, "add", stateKey = Some("shared"), value = Some("1"))
    for doc <- List(
        base.copy(actions = List(copy, increment)),
        base.copy(actions =
          List(copy, WebAction("shared", WebActionKind.Toggle, "toggle", region = Some("panel")))
        ),
        base.copy(actions = List(copy), persistentKeys = List("shared")),
        base.copy(actions = List(copy.copy(stateKey = None)))
      )
    do
      assertEquals(
        WebDocumentDecoder.decode(doc.asJson.noSpaces).toOption.get.initialState,
        base.initialState
      )
    val existing = base.copy(actions = List(copy), initialState = Map("shared" -> "已有反馈"))
    assertEquals(WebDocumentDecoder.decode(existing.asJson.noSpaces), Right(existing))
  }
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
