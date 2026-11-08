package services.generation
import cats.effect.{IO, IOApp}
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import services.browser.api.{ValidateWebDocumentMessage, NormalizeWebDocumentMessage}
import services.generation.utils.WebDocumentDecoder

object TextFigureReplay extends IOApp.Simple:
  def run: IO[Unit] =
    for
      record <- IO.blocking(
        parse(
          Files.readString(Paths.get("../.cache/effort-sampling-v1/essay-new-standard.json"))
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
      result <- NormalizeWebDocumentMessage(decoded, address)
        .plan(null)
        .flatMap(normalized => ValidateWebDocumentMessage(normalized, address).plan(null))
        .attempt
      _ <- IO.blocking {
        val directory = Paths.get("../.cache/text-figure-replay")
        Files.createDirectories(directory)
        result.foreach(doc =>
          Files.writeString(
            directory.resolve("text-figure-new-standard.json"),
            record.deepMerge(Json.obj("document" -> doc.asJson, "error" -> Json.Null)).spaces2
          )
        )
        Files.writeString(
          Paths.get("../.data/release-archive/docs/acceptance/text-figure-replay.json"),
          Json
            .obj(
              "source" -> "effort-sampling-v1/essay-new-standard.json".asJson,
              "pageId" -> record.hcursor.downField("pageId").focus.get,
              "jobId" -> record.hcursor.downField("jobId").focus.get,
              "originalFailureRetained" -> true.asJson,
              "extraModelCalls" -> 0.asJson,
              "validated" -> result.isRight.asJson,
              "remainingError" -> result.left.toOption.map(_.getMessage).asJson
            )
            .spaces2
        )
      }
      _ <- IO.println(s"Text figure replay validated=${result.isRight}; no model calls")
    yield ()
