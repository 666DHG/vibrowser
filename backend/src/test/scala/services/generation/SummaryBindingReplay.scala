package services.generation

import cats.effect.{IO, IOApp, Ref}
import cats.syntax.all.*
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import scala.concurrent.duration.*
import org.http4s.ember.client.EmberClientBuilder
import org.jsoup.Jsoup
import services.browser.objects.*
import services.browser.tables.PageTable.PageTable
import services.generation.objects.*
import services.generation.utils.*
import services.settings.api.GetProviderConnectionMessage
import services.settings.tables.SettingsTable.SettingsTable
import services.system.DatabaseSession

/** One repair of a preserved raw response; original comparison rows stay unchanged. */
object SummaryBindingReplay extends IOApp.Simple:
  def run: IO[Unit] =
    require(
      sys.env.get("VIBROWSER_PAID_EFFORT_ACCEPTANCE").contains("true"),
      "Paid opt-in required"
    )
    val output = Paths.get("../.cache/summary-binding-replay.json")
    val marker = Paths.get("../.cache/summary-binding-replay-started.json")
    require(
      !Files.exists(output) && !Files.exists(marker),
      "Existing or unfinished repair retained"
    )
    val resources = for
      live <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=vibrowser_live",
        "vibrowser",
        ""
      )
      db <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=effort_guidance_v4",
        "vibrowser",
        ""
      )
      http <- EmberClientBuilder
        .default[IO]
        .withTimeout(190.seconds)
        .withIdleConnectionTime(200.seconds)
        .build
    yield (live, db, http)
    resources.use { (live, db, http) =>
      for
        record <- IO.blocking(
          parse(Files.readString(Paths.get("../.cache/effort-guidance-v4/copy-new-standard.json")))
            .fold(throw _, identity)
        )
        workflow <- IO.fromEither(record.hcursor.get[DesignWorkflow]("workflow"))
        _ <- IO.raiseUnless(workflow.guidanceVersion == DesignGuidance.version)(
          new Exception("Original guidance required")
        )
        attempts <- IO.fromEither(record.hcursor.get[List[GenerationAttempt]]("attempts"))
        original <- IO.fromOption(
          attempts.find(_.outcome == AttemptOutcome.Accepted).flatMap(_.output)
        )(new Exception("Accepted raw response required"))
        raw <- IO.fromEither(WebDocumentDecoder.decode(original))
        parsed = Jsoup.parseBodyFragment(raw.html)
        paragraphs = raw.actions
          .filter(_.kind == WebActionKind.Copy)
          .flatMap(_.region)
          .distinct
          .flatMap(id => Option(parsed.getElementById(id)).map(_.text()))
          .filter(_.nonEmpty)
        _ <- IO.raiseUnless(paragraphs.nonEmpty)(new Exception("No original copy paragraphs"))
        id <- IO.fromEither(record.hcursor.get[PageId]("pageId"))
        page <- db
          .transaction(c => PageTable.findById(c, id))
          .flatMap(IO.fromOption(_)(new Exception("Source page missing")))
        _ <- IO.raiseUnless(
          page.effort == GenerationEffort.Standard && page.mode == BrowsingMode.Imagination
        )(new Exception("Original experiment mode required"))
        config <- live.transaction(c =>
          SettingsTable.get(c).flatMap(s => GetProviderConnectionMessage(s.revision).plan(c))
        )
        calls <- Ref.of[IO, Vector[Json]](Vector.empty)
        client = new DeepSeekCompatibleClient(EffortAcceptance.metered(http, calls))
        generator = new WebDocumentGeneration(db, client)
        invalid <- generator.validate(page, original, None, None).attempt
        error <- IO.fromOption(
          invalid.left.toOption.filter(
            _.getMessage.contains("summary binding would overwrite visible content")
          )
        )(new Exception("Expected content-loss rejection absent"))
        request <- IO.fromEither(record.hcursor.get[String]("request"))
        prompt =
          request + "\n设计指导：\n" + DesignGuidance.design + "\n交互能力：\n" + WebDocumentPrompt.actionContract + "\n设计说明：" + workflow.brief.asJson.noSpaces
        _ <- IO.blocking(
          Files.writeString(
            marker,
            Json.obj("pageId" -> id.asJson, "at" -> java.time.Instant.now.toString.asJson).spaces2
          )
        )
        start <- IO.monotonic
        response <- client
          .complete(
            config,
            WebDocumentPrompt.system,
            WebDocumentPrompt.repair(prompt, original, error.getMessage),
            false
          )
          .attempt
        result <- response
          .traverse(text => generator.validate(page, text, None, None))
          .attempt
          .map(_.flatMap(identity))
        end <- IO.monotonic
        preserved = result.toOption
          .map(d => {
            val text = Jsoup.parseBodyFragment(d.html).text()
            paragraphs.count(text.contains)
          })
          .getOrElse(0)
        usage <- calls.get
        _ <- IO.blocking(
          Files.writeString(
            output,
            Json
              .obj(
                "pageId" -> id.asJson,
                "jobId" -> page.currentJobId.asJson,
                "request" -> request.asJson,
                "input" -> page.prompt.asJson,
                "mode" -> page.mode.asJson,
                "effort" -> page.effort.asJson,
                "guardError" -> error.getMessage.asJson,
                "seconds" -> (end - start).toSeconds.asJson,
                "modelCalls" -> usage.asJson,
                "originalParagraphs" -> paragraphs.size.asJson,
                "preservedParagraphs" -> preserved.asJson,
                "document" -> result.toOption.asJson,
                "error" -> result.left.toOption.map(_.getMessage).asJson,
                "output" -> response.toOption.asJson,
                "storedPagesChanged" -> false.asJson
              )
              .spaces2
          )
        )
        _ <- IO.println(
          s"Summary repair accepted=${result.isRight}, paragraphs=$preserved/${paragraphs.size}; one request only"
        )
      yield ()
    }
