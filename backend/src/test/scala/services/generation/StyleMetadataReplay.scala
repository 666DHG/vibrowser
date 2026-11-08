package services.generation
import cats.effect.{IO, IOApp}
import cats.syntax.all.*
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import services.browser.api.{NormalizeWebDocumentMessage, ValidateWebDocumentMessage}
import services.generation.utils.WebDocumentDecoder

/** Select the earliest fully valid saved response; never rerolls or changes the paid experiment. */
object StyleMetadataReplay extends IOApp.Simple:
  private val topic = sys.env.getOrElse("VIBROWSER_STYLE_REPLAY_TOPIC", "copy")
  private val suffix = if topic == "copy" then "" else "-" + topic
  def run: IO[Unit] = for
    _ <- IO.raiseUnless(Set("copy", "calendar", "essay")(topic))(
      new IllegalArgumentException("Recorded sample required")
    )
    record <- IO.blocking(
      parse(
        Files.readString(
          Paths.get(s"../.cache/effort-guidance-v8-product/$topic-new-standard.json")
        )
      ).toOption.get
    )
    address = parse(
      record.hcursor.get[String]("request").toOption.get.linesIterator.next()
    ).toOption.get.hcursor.downField("target").get[String]("address").toOption.get
    checks <- record.hcursor.get[List[Json]]("attempts").toOption.get.traverse { a =>
      IO.fromEither(WebDocumentDecoder.decode(a.hcursor.get[String]("output").toOption.get))
        .flatMap(decoded =>
          NormalizeWebDocumentMessage(decoded, address)
            .plan(null)
            .flatMap(doc => ValidateWebDocumentMessage(doc, address).plan(null))
            .map(valid => (decoded, valid))
        )
        .attempt
        .map(result => (a, result))
    }
    selected <- IO.fromOption(checks.find(_._2.isRight))(
      new IllegalStateException("No saved response passes complete validation")
    )
    attempt = selected._1
    decoded = selected._2.toOption.get._1
    result = selected._2.map(_._2)
    raw <- IO.fromEither(parse(attempt.hcursor.get[String]("output").toOption.get))
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
        Paths.get(
          "../.data/release-archive/docs/acceptance/style-metadata-replay" + suffix + ".json"
        ),
        Json
          .obj(
            "source" -> s"effort-guidance-v8-product/$topic-new-standard.json".asJson,
            "sourceAttempt" -> attempt.hcursor.get[Int]("attempt").toOption.asJson,
            "validationAttempts" -> checks.map { (a, checked) =>
              Json.obj(
                "attempt" -> a.hcursor.get[Int]("attempt").toOption.asJson,
                "validated" -> checked.isRight.asJson,
                "error" -> checked.left.toOption.map(_.getMessage).asJson
              )
            }.asJson,
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
