package services.generation
import cats.effect.{IO, IOApp, Ref}
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import scala.concurrent.duration.*
import org.http4s.ember.client.EmberClientBuilder
import services.browser.api.RetryPageMessage
import services.browser.objects.PageId
import services.browser.tables.PageTable.PageTable
import services.generation.api.*
import services.generation.objects.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.generation.utils.*
import services.settings.api.GetProviderConnectionMessage
import services.settings.tables.SettingsTable.SettingsTable
import services.system.DatabaseSession

/** One explicit post-fix retry of the failed fixed sample, retaining the original job and report.
  */
object ProductFailureAcceptance extends IOApp.Simple:
  def run: IO[Unit] =
    require(sys.env.get("VIBROWSER_PAID_PRODUCT_RETRY").contains("true"), "Paid opt-in required")
    val directory = Paths.get("../.cache/product-failed-retry")
    val output = directory.resolve("essay-new-standard.json")
    val marker = directory.resolve("essay-started.json")
    require(!Files.exists(output) && !Files.exists(marker), "Existing retry retained")
    val resources = for
      live <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=vibrowser_live",
        "vibrowser",
        ""
      )
      database <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=effort_guidance_v8_product",
        "vibrowser",
        ""
      )
      http <- EmberClientBuilder
        .default[IO]
        .withTimeout(610.seconds)
        .withIdleConnectionTime(620.seconds)
        .build
    yield (live, database, http)
    resources.use { (live, database, http) =>
      for
        record <- IO.blocking(
          parse(
            Files.readString(
              Paths.get("../.cache/effort-guidance-v8-product/essay-new-standard.json")
            )
          ).toOption.get
        )
        _ <- IO.raiseUnless(record.hcursor.get[String]("error").isRight)(
          new IllegalArgumentException("Failed fixed sample required")
        )
        pageId <- IO.fromEither(record.hcursor.get[PageId]("pageId"))
        oldJob <- IO.fromEither(record.hcursor.get[JobId]("jobId"))
        saved <- IO.fromEither(record.hcursor.get[DesignWorkflow]("workflow"))
        _ <- IO.raiseUnless(saved.guidanceVersion == DesignGuidance.current.version)(
          new IllegalArgumentException("Original guidance required")
        )
        config <- live.transaction(c =>
          SettingsTable.get(c).flatMap(s => GetProviderConnectionMessage(s.revision).plan(c))
        )
        _ <- IO.raiseUnless(
          java.net.URI.create(config.baseUrl).getHost == "api.deepseek.com" && record.hcursor
            .downField("modelCalls")
            .downArray
            .get[String]("model")
            .contains(config.model)
        )(new IllegalArgumentException("Original official model required"))
        _ <- IO.blocking {
          Files.createDirectories(directory); Files.writeString(marker, oldJob.asJson.noSpaces)
        }
        navigation <- database.transaction(RetryPageMessage(pageId, oldJob).plan)
        job <- database.transaction(ClaimGenerationJobMessage().plan).map(_.get)
        _ <- IO.raiseUnless(job.id == navigation.jobId)(
          new IllegalStateException("Unexpected queued job")
        )
        page <- database.transaction(c => PageTable.findById(c, pageId)).map(_.get)
        calls <- Ref.of[IO, Vector[Json]](Vector.empty)
        start <- IO.monotonic
        result <- new DesignWorkflowGeneration(
          database,
          new DeepSeekCompatibleClient(EffortAcceptance.metered(http, calls)),
          new NodeLayoutMeasurer
        )
          .generate(config, page, record.hcursor.get[String]("request").toOption.get, None, None)
          .attempt
        _ <- result.fold(
          error => database.transaction(FailGenerationJobMessage(job.id, error.getMessage).plan),
          doc => database.transaction(CompleteWebDocumentMessage(job.id, doc, "live").plan)
        )
        end <- IO.monotonic
        workflow <- database.transaction(c => GenerationJobTable.designWorkflow(c, job.id))
        attempts <- database.transaction(c => GenerationJobTable.diagnostics(c, job.id))
        usage <- calls.get
        _ <- IO.blocking(
          Files.writeString(
            output,
            record
              .deepMerge(
                Json.obj(
                  "originalJobId" -> oldJob.asJson,
                  "originalError" -> record.hcursor.downField("error").focus.get,
                  "jobId" -> job.id.asJson,
                  "document" -> result.toOption.asJson,
                  "error" -> result.left.toOption.map(_.getMessage).asJson,
                  "seconds" -> (end - start).toSeconds.asJson,
                  "workflow" -> workflow.asJson,
                  "attempts" -> attempts.asJson,
                  "modelCalls" -> usage.asJson,
                  "postFixRetry" -> true.asJson
                )
              )
              .spaces2
          )
        )
        _ <- IO.println(
          s"Product failed-sample retry ready=${result.isRight}; original report retained"
        )
      yield ()
    }
