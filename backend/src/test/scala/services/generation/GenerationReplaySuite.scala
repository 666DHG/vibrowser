package services.generation
import munit.CatsEffectSuite
import cats.effect.IO
import cats.syntax.all.*
import java.nio.file.{Files, Paths}
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import services.generation.utils.WebDocumentDecoder
import services.browser.api.{NormalizeWebDocumentMessage, ValidateWebDocumentMessage}

// Opt-in local corpus: no API keys, network calls or database mutation.
class GenerationReplaySuite extends CatsEffectSuite:
  if sys.env.get("VIBROWSER_GENERATION_REPLAY").contains("true") then
    test("real rejected outputs pass the corrected compiler without model calls") {
      for
        data <- IO.blocking(Files.readString(Paths.get("../.cache/generation-replay.json")))
        rows <- IO.fromEither(parse(data)).map(_.asArray.get.toList)
        results <- rows.traverse { row =>
          val c = row.hcursor
          val output = c.get[String]("output").toOption.get
          val address = c.get[String]("address").toOption.get
          (for
            decoded <- IO.fromEither(WebDocumentDecoder.decode(output))
            normalized <- NormalizeWebDocumentMessage(decoded, address).plan(null)
            checked <- ValidateWebDocumentMessage(normalized, address).plan(null)
          yield checked).attempt.map { result =>
            Json.obj(
              "pageId" -> c.get[String]("pageId").toOption.asJson,
              "originalError" -> c.get[String]("error").toOption.asJson,
              "passed" -> result.isRight.asJson,
              "remainingError" -> result.swap.toOption.map(_.getMessage).asJson,
              "modelRequests" -> 0.asJson
            )
          }
        }
        _ <- IO.blocking(
          Files.writeString(
            Paths.get("../docs/acceptance/reliability-replay-2026-11-05.json"),
            results.asJson.spaces2
          )
        )
        _ = assert(
          results.forall(_.hcursor.get[Boolean]("passed").contains(true)),
          results.asJson.spaces2
        )
      yield ()
    }
