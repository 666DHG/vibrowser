package services.generation

import cats.effect.{IO, IOApp, Ref}
import cats.syntax.all.*
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import scala.concurrent.duration.*
import org.http4s.ember.client.EmberClientBuilder
import services.browser.objects.{PageId, ResearchSnapshot}
import services.browser.tables.PageTable.PageTable
import services.generation.objects.*
import services.generation.utils.*
import services.settings.api.GetProviderConnectionMessage
import services.settings.objects.ProviderConnection
import services.settings.tables.SettingsTable.SettingsTable
import services.system.DatabaseSession

/** One paid, same-prompt capacity retest; never replaces a fixed comparison sample. */
object EffortBudgetReplay extends IOApp.Simple:
  def run: IO[Unit] =
    require(
      sys.env.get("VIBROWSER_PAID_EFFORT_ACCEPTANCE").contains("true"),
      "Explicit paid opt-in required"
    )
    val label = sys.env.getOrElse("VIBROWSER_EFFORT_BUDGET_SAMPLE", "calendar-new-deep")
    require(
      Set("calendar-new-deep", "comparison-new-deep")(label),
      "Only observed truncation cases"
    )
    val directory = Paths.get("../.cache/effort-budget-replay")
    val output = directory.resolve(label + ".json")
    val marker = directory.resolve(label + "-started.json")
    require(
      !Files.exists(output) && !Files.exists(marker),
      "Existing or unfinished retest retained"
    )
    val resources = for
      live <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=vibrowser_live",
        "vibrowser",
        ""
      )
      db <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=effort_acceptance",
        "vibrowser",
        ""
      )
      http <- EmberClientBuilder
        .default[IO]
        .withTimeout(610.seconds)
        .withIdleConnectionTime(620.seconds)
        .build
    yield (live, db, http)
    resources.use { (live, db, http) =>
      for
        record <- IO.blocking(
          parse(Files.readString(Paths.get("../.cache/effort-acceptance/" + label + ".json")))
            .fold(throw _, identity)
        )
        _ <- IO.raiseUnless(
          record.hcursor
            .downField("attempts")
            .focus
            .exists(
              _.asArray.toList.flatten
                .exists(_.hcursor.get[String]("errorCode").contains("provider_content"))
            )
        )(new Exception("No recorded truncation to retest"))
        workflow <- IO.fromEither(record.hcursor.get[DesignWorkflow]("workflow"))
        guidance <- IO.blocking {
          parse(Files.readString(Paths.get("../.cache/effort-acceptance/guidance-v2.json")))
            .flatMap(_.as[DesignGuidanceText])
            .fold(throw _, identity)
        }
        _ <- IO.raiseUnless(guidance.version == workflow.guidanceVersion)(
          new Exception("Original guidance snapshot required")
        )
        request <- IO.fromEither(record.hcursor.get[String]("request"))
        pageId <- IO.fromEither(record.hcursor.get[PageId]("pageId"))
        page <- db
          .transaction(c => PageTable.findById(c, pageId))
          .flatMap(IO.fromOption(_)(new Exception("Parent sample missing")))
        research <- IO.fromEither(record.hcursor.get[Option[ResearchSnapshot]]("research"))
        _ <- IO.raiseUnless(page.effort == GenerationEffort.Deep)(
          new Exception("Deep sample required")
        )
        base <- live.transaction(c =>
          SettingsTable.get(c).flatMap(s => GetProviderConnectionMessage(s.revision).plan(c))
        )
        config = new ProviderConnection(
          base.baseUrl,
          base.model,
          base.key,
          base.revision,
          page.effort
        )
        prompt =
          request + "\n设计指导：\n" + guidance.design + "\n交互能力：\n" + WebDocumentPrompt.actionContract + "\n设计说明：" + workflow.brief.asJson.noSpaces
        calls <- Ref.of[IO, Vector[Json]](Vector.empty)
        client = new DeepSeekCompatibleClient(EffortAcceptance.metered(http, calls))
        _ <- IO.blocking {
          Files.createDirectories(directory)
          Files.writeString(
            marker,
            Json
              .obj(
                "originalPageId" -> page.id.asJson,
                "at" -> java.time.Instant.now.toString.asJson
              )
              .spaces2
          )
        }
        start <- IO.monotonic
        response <- client.complete(config, WebDocumentPrompt.system, prompt, false).attempt
        checked <- response
          .traverse(text =>
            new WebDocumentGeneration(db, client).validate(page, text, None, research)
          )
          .attempt
          .map(_.flatMap(identity))
        end <- IO.monotonic
        usage <- calls.get
        _ <- IO.blocking(
          Files.writeString(
            output,
            Json
              .obj(
                "sample" -> label.asJson,
                "originalPageId" -> page.id.asJson,
                "originalJobId" -> page.currentJobId.asJson,
                "seconds" -> (end - start).toSeconds.asJson,
                "modelCalls" -> usage.asJson,
                "error" -> checked.left.toOption.map(_.getMessage).asJson,
                "document" -> checked.toOption.asJson,
                "output" -> response.toOption.asJson,
                "storedPagesChanged" -> false.asJson
              )
              .spaces2
          )
        )
        _ <- IO.println(
          s"Capacity retest $label accepted=${checked.isRight}; one request, original sample retained"
        )
      yield ()
    }
