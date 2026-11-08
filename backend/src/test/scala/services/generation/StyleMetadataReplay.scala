package services.generation
import cats.effect.{IO, IOApp}
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import services.browser.api.{NormalizeWebDocumentMessage, ValidateWebDocumentMessage}
import services.generation.utils.WebDocumentDecoder

/** Validate the original first response; never changes the paid experiment. */
object StyleMetadataReplay extends IOApp.Simple:
  private val topic = sys.env.getOrElse("VIBROWSER_STYLE_REPLAY_TOPIC", "copy")
  private val suffix = if topic == "copy" then "" else "-" + topic
  def run: IO[Unit] = for
    _ <- IO.raiseUnless(Set("copy", "calendar")(topic))(
      new IllegalArgumentException("Recorded sample required")
    )
    record <- IO.blocking(
      parse(
        Files.readString(
          Paths.get(s"../.cache/effort-guidance-v8-product/$topic-new-standard.json")
        )
      ).toOption.get
    )
    attempt = record.hcursor.get[List[Json]]("attempts").toOption.get.head
    text = attempt.hcursor.get[String]("output").toOption.get
    raw <- IO.fromEither(parse(text))
    decoded <- IO.fromEither(WebDocumentDecoder.decode(text))
    address = parse(
      record.hcursor.get[String]("request").toOption.get.linesIterator.next()
    ).toOption.get.hcursor.downField("target").get[String]("address").toOption.get
    result <- NormalizeWebDocumentMessage(decoded, address)
      .plan(null)
      .flatMap(doc => ValidateWebDocumentMessage(doc, address).plan(null))
      .attempt
    _ <- IO.blocking {
      val directory = Paths.get("../.cache/style-metadata-replay" + suffix)
      Files.createDirectories(directory)
      result.foreach(doc =>
        Files.writeString(
          directory.resolve(topic + "-new-standard.json"),
          record
            .deepMerge(
              Json.obj(
                "document" -> doc.asJson,
                "error" -> Json.Null,
                "workflow" -> Json.Null,
                "offlineReplay" -> true.asJson,
                "modelCalls" -> Json.arr(),
                "attempts" -> Json.arr(attempt.deepMerge(Json.obj("outcome" -> "Accepted".asJson)))
              )
            )
            .spaces2
        )
      )
      Files.writeString(
        Paths.get("../docs/acceptance/style-metadata-replay" + suffix + ".json"),
        Json
          .obj(
            "source" -> s"effort-guidance-v8-product/$topic-new-standard.json".asJson,
            "sourceAttempt" -> 1.asJson,
            "originalFailureRetained" -> true.asJson,
            "extraModelCalls" -> 0.asJson,
            "validated" -> result.isRight.asJson,
            "remainingError" -> result.left.toOption.map(_.getMessage).asJson,
            "htmlUnchangedByDecoder" -> raw.hcursor
              .get[String]("html")
              .contains(decoded.html)
              .asJson,
            "cssUnchangedByDecoder" -> raw.hcursor.get[String]("css").contains(decoded.css).asJson,
            "palettePreserved" -> parse(decoded.siteStyle.palette).toOption
              .contains(raw.hcursor.downField("siteStyle").downField("palette").focus.get)
              .asJson
          )
          .spaces2
      )
    }
    _ <- IO.println(s"Original style-metadata response validated=${result.isRight}; no model calls")
  yield ()
