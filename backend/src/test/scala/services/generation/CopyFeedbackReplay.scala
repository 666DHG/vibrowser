package services.generation
import cats.effect.{IO, IOApp}
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import services.browser.api.{ValidateWebDocumentMessage, NormalizeWebDocumentMessage}
import services.generation.utils.WebDocumentDecoder

/** Replay the preserved failed response without another model request. */
object CopyFeedbackReplay extends IOApp.Simple:
  def run: IO[Unit] =
    for
      record <- IO.blocking(
        parse(
          Files.readString(Paths.get("../.cache/effort-sampling-v1/copy-new-standard.json"))
        ).toOption.get
      )
      output = record.hcursor
        .get[List[Json]]("attempts")
        .toOption
        .get
        .last
        .hcursor
        .get[String]("output")
        .toOption
        .get
      decoded <- IO.fromEither(WebDocumentDecoder.decode(output))
      request = record.hcursor.get[String]("request").toOption.get
      address = parse(request.linesIterator.next()).toOption.get.hcursor
        .downField("target")
        .get[String]("address")
        .toOption
        .get
      validated <- NormalizeWebDocumentMessage(decoded, address)
        .plan(null)
        .flatMap(normalized => ValidateWebDocumentMessage(normalized, address).plan(null))
        .attempt
      _ <- IO.blocking {
        val directory = Paths.get("../.cache/copy-feedback-replay")
        Files.createDirectories(directory)
        validated.foreach(document =>
          Files.writeString(
            directory.resolve("copy-feedback-new-standard.json"),
            record.deepMerge(Json.obj("document" -> document.asJson, "error" -> Json.Null)).spaces2
          )
        )
        val raw = parse(output).toOption.get
        Files.writeString(
          Paths.get("../.data/release-archive/docs/acceptance/copy-feedback-replay.json"),
          Json
            .obj(
              "source" -> "effort-sampling-v1/copy-new-standard.json".asJson,
              "pageId" -> record.hcursor.downField("pageId").focus.get,
              "jobId" -> record.hcursor.downField("jobId").focus.get,
              "originalFailureRetained" -> true.asJson,
              "extraModelCalls" -> 0.asJson,
              "normalizedKeys" -> decoded.initialState.keys.toList.sorted.asJson,
              "htmlUnchangedByDecoder" -> (decoded.html == raw.hcursor
                .get[String]("html")
                .toOption
                .get).asJson,
              "validated" -> validated.isRight.asJson,
              "remainingError" -> validated.left.toOption.map(_.getMessage).asJson
            )
            .spaces2
        )
      }
      _ <- IO.println(
        s"Copy feedback replay validated=${validated.isRight}; no model calls"
      )
    yield ()
