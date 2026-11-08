package services.generation

import cats.effect.{IO, IOApp}
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import services.generation.api.FailGenerationJobMessage
import services.generation.objects.JobId
import services.system.DatabaseSession

/** Explicit recovery for the observed stopped process; no model call or automatic reroll. */
object CloseInterruptedEffortSample extends IOApp.Simple:
  def run: IO[Unit] =
    val directory = Paths.get("../.cache/effort-acceptance")
    val output = directory.resolve("docs-new-deep.json")
    require(!Files.exists(output), "Existing result must not be overwritten")
    DatabaseSession
      .resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=effort_acceptance",
        "vibrowser",
        ""
      )
      .use { db =>
        for
          saved <- IO.blocking(
            parse(Files.readString(directory.resolve("docs-new-deep-interrupted-state.json")))
              .fold(throw _, identity)
          )
          reference <- IO.blocking(
            parse(Files.readString(directory.resolve("docs-new-standard.json")))
              .fold(throw _, identity)
          )
          job <- IO.fromEither(saved.hcursor.get[JobId]("jobId"))
          error =
            "Experiment process stopped during generation; response and usage were not captured. No request was reissued."
          _ <- db.transaction(FailGenerationJobMessage(job, error).plan)
          record = Json.obj(
            "input" -> reference.hcursor.downField("input").focus.get,
            "mode" -> reference.hcursor.downField("mode").focus.get,
            "effort" -> "deep".asJson,
            "guidance" -> reference.hcursor.downField("guidance").focus.get,
            "pageId" -> saved.hcursor.downField("pageId").focus.get,
            "jobId" -> job.asJson,
            "seconds" -> Json.Null,
            "request" -> reference.hcursor.downField("request").focus.get,
            "research" -> saved.hcursor.downField("research").downField("snapshot").focus.get,
            "document" -> Json.Null,
            "error" -> error.asJson,
            "workflow" -> saved.hcursor.downField("workflow").focus.get,
            "attempts" -> saved.hcursor.downField("attempts").focus.get,
            "modelCalls" -> Json.arr(),
            "interrupted" -> true.asJson,
            "usageComplete" -> false.asJson
          )
          _ <- IO.blocking(Files.writeString(output, record.spaces2))
          _ <- IO.println(
            "Interrupted docs/deep sample retained as failure with unknown usage; no model calls"
          )
        yield ()
      }
