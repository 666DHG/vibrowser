package services.generation
import munit.CatsEffectSuite
import cats.effect.IO
import java.nio.file.{Files, Paths}
import io.circe.{Json, Decoder}
import io.circe.parser.parse
import services.generation.utils.{GeneratedPageDecoder, PromptBuilder}
import services.browser.objects.*
import services.browser.api.ValidateGeneratedContentMessage

class GeneratedPageDecoderSuite extends CatsEffectSuite:
  private val raw =
    Files.readString(Paths.get("../contracts/fixtures/provider/nested-shorthand.json"))
  private val base = "https://moon-coffee.example/"
  test(
    "real response shorthand becomes typed blocks without dropping content or hiding count violations"
  ) {
    val spec = GeneratedPageDecoder.decode(raw).toOption.get
    assertEquals(spec.blocks.head.items.head.`type`, BlockType.Button)
    assertEquals(spec.blocks.head.items.head.target, Some("/beans"))
    assertEquals(spec.blocks(4).items.head.`type`, BlockType.Card)
    assertEquals(spec.blocks(4).items.head.target, Some("/beans/night-ship"))
    ValidateGeneratedContentMessage(spec, base).plan(null).map { issues =>
      assert(issues.exists(_.message.contains("当前为 15")))
    }
  }
  test("bounded shorthand page passes the unchanged PageSpec validator") {
    val source = parse(raw).toOption.get
    val blocks = source.hcursor.get[Vector[Json]]("blocks").toOption.get.map { value =>
      val kind = value.hcursor.get[String]("type").toOption.get
      if Set("navbar", "grid")(kind) then
        value.mapObject { fields =>
          fields.add(
            "items",
            Json.fromValues(fields("items").get.asArray.get.take(if kind == "navbar" then 1 else 2))
          )
        }
      else value
    }
    val spec = GeneratedPageDecoder
      .decode(source.mapObject(_.add("blocks", Json.fromValues(blocks))).noSpaces)
      .toOption
      .get
    ValidateGeneratedContentMessage(spec, base).plan(null).map(issues => assertEquals(issues, Nil))
  }
  test("unknown explicit component is rejected with a field path") {
    val result =
      GeneratedPageDecoder.decode(raw.replace("\"type\": \"hero\"", "\"type\": \"script\""))
    assert(result.isLeft)
    assert(result.left.toOption.get.getMessage.contains(".blocks[1].type"))
  }
  test("normalization does not bypass unsafe link validation") {
    val spec =
      GeneratedPageDecoder.decode(raw.replace("/beans", "javascript:alert(1)")).toOption.get
    ValidateGeneratedContentMessage(spec, base).plan(null).map { issues =>
      assert(issues.exists(_.path.endsWith(".target")))
    }
  }
  test("repair includes bounded original output and the exact validation error") {
    val prompt = PromptBuilder.repair("user input", "x" * 30000, ".blocks[0].items[0].id: missing")
    assert(prompt.contains(".blocks[0].items[0].id"))
    assert(prompt.contains("previousOutput"))
    assert(prompt.length < 25000)
  }
  test("full nested prompt example satisfies the actual renderer contract") {
    val text =
      PromptBuilder.system.substring(PromptBuilder.system.indexOf("{\"schemaVersion\"")).trim
    val spec = io.circe.parser.decode[PageSpec](text).toOption.get
    ValidateGeneratedContentMessage(spec, base).plan(null).map(issues => assertEquals(issues, Nil))
  }
