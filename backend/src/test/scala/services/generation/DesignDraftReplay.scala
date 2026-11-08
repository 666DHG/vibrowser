package services.generation
import cats.effect.{IO, IOApp}
import cats.syntax.all.*
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import services.browser.api.{NormalizeWebDocumentMessage, ValidateWebDocumentMessage}
import services.generation.utils.{DesignPreservation, WebDocumentDecoder}

/** Check saved assembly attempts without rerolling or changing the original experiment. */
object DesignDraftReplay extends IOApp.Simple:
  private val topic = sys.env.getOrElse("VIBROWSER_DRAFT_REPLAY_TOPIC", "copy")
  require(Set("copy", "comparison")(topic), "Replay only a recorded fixed sample")
  private val suffix = if topic == "copy" then "" else "-" + topic
  def run: IO[Unit] =
    for
      record <- IO.blocking(
        parse(
          Files.readString(Paths.get(s"../.cache/effort-guidance-v9/$topic-new-standard.json"))
        ).toOption.get
      )
      request = record.hcursor.get[String]("request").toOption.get
      address = parse(request.linesIterator.next()).toOption.get.hcursor
        .downField("target")
        .get[String]("address")
        .toOption
        .get
      draft = record.hcursor
        .downField("workflow")
        .downField("draft")
        .get[String]("html")
        .toOption
        .get
      attempts <- record.hcursor.get[List[Json]]("attempts").toOption.get.traverse { attempt =>
        val output = attempt.hcursor.get[String]("output").toOption.get
        (for
          decoded <- IO.fromEither(WebDocumentDecoder.decode(output))
          normalized <- NormalizeWebDocumentMessage(decoded, address).plan(null)
          validated <- ValidateWebDocumentMessage(normalized, address).plan(null)
          _ <- IO.raiseUnless(DesignPreservation.preservesProse(draft, validated.html))(
            new IllegalArgumentException("Draft prose not preserved")
          )
        yield validated).attempt.map(result => (attempt, result))
      }
      _ <- IO.blocking {
        val directory = Paths.get(s"../.cache/design-draft-replay$suffix")
        Files.createDirectories(directory)
        attempts
          .collectFirst { case (_, Right(document)) => document }
          .foreach(document =>
            Files.writeString(
              directory.resolve(s"$topic-new-standard.json"),
              record
                .deepMerge(Json.obj("document" -> document.asJson, "error" -> Json.Null))
                .spaces2
            )
          )
        Files.writeString(
          Paths.get(s"../docs/acceptance/design-draft-replay$suffix.json"),
          Json
            .obj(
              "source" -> s"effort-guidance-v9/$topic-new-standard.json".asJson,
              "originalFailureRetained" -> true.asJson,
              "extraModelCalls" -> 0.asJson,
              "attempts" -> attempts.map { case (attempt, result) =>
                Json.obj(
                  "attempt" -> attempt.hcursor.downField("attempt").focus.get,
                  "validated" -> result.isRight.asJson,
                  "remainingError" -> result.left.toOption.map(_.getMessage).asJson
                )
              }.asJson
            )
            .spaces2
        )
      }
      _ <- IO.println(
        s"Draft replay: ${attempts.count(_._2.isRight)}/${attempts.size} accepted; zero model calls"
      )
    yield ()
