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

/** One same-input capacity request for a failed low sample; no database writes or rerolls. */
object LowCapacityAcceptance extends IOApp.Simple:
  def run: IO[Unit] =
    require(
      sys.env.get("VIBROWSER_PAID_EFFORT_ACCEPTANCE").contains("true"),
      "Paid opt-in required"
    )
    val topic = sys.env.getOrElse("VIBROWSER_LOW_CAPACITY_SAMPLE", "docs")
    require(Set("docs", "essay")(topic), "Only fixed long-form samples")
    val label = topic + "-new-standard"
    val directory = Paths.get("../.cache/effort-low-capacity")
    val output = directory.resolve(label + ".json")
    val marker = directory.resolve(label + "-started.json")
    require(!Files.exists(output) && !Files.exists(marker), "Existing request retained")
    val resources = for
      live <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=vibrowser_live",
        "vibrowser",
        ""
      )
      db <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=effort_guidance_v8_low",
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
          parse(
            Files.readString(Paths.get(s"../.cache/effort-guidance-v8-low/$label.json"))
          ).toOption.get
        )
        _ <- IO.raiseUnless(
          record.hcursor.get[String]("error").toOption.nonEmpty &&
            record.hcursor.get[String]("effortPolicy").contains("experimental-low") &&
            record.hcursor
              .get[List[Json]]("modelCalls")
              .toOption
              .toList
              .flatten
              .exists(_.hcursor.get[String]("finishReason").contains("length"))
        )(new IllegalArgumentException("Recorded failed truncation required"))
        workflow <- IO.fromEither(record.hcursor.get[DesignWorkflow]("workflow"))
        _ <- IO.raiseUnless(workflow.guidanceVersion == DesignGuidance.current.version)(
          new IllegalArgumentException("Saved guidance must match the build")
        )
        pageId <- IO.fromEither(record.hcursor.get[PageId]("pageId"))
        page <- db.transaction(c => PageTable.findById(c, pageId)).map(_.get)
        research <- IO.fromEither(record.hcursor.get[Option[ResearchSnapshot]]("research"))
        base <- live.transaction(c =>
          SettingsTable.get(c).flatMap(s => GetProviderConnectionMessage(s.revision).plan(c))
        )
        _ <- IO.raiseUnless(
          record.hcursor
            .downField("modelCalls")
            .downArray
            .get[String]("model")
            .contains(base.model) &&
            Option(java.net.URI.create(base.baseUrl).getHost).contains("api.deepseek.com")
        )(new IllegalArgumentException("Original official provider model required"))
        config = new ProviderConnection(
          base.baseUrl,
          base.model,
          base.key,
          base.revision,
          GenerationEffort.Standard
        )
        prompt = DesignPrompts.pageRequest(
          record.hcursor.get[String]("request").toOption.get,
          DesignGuidance.current,
          workflow
        )
        calls <- Ref.of[IO, Vector[Json]](Vector.empty)
        client = new DeepSeekCompatibleClient(
          EffortAcceptance.metered(http, calls, lowThinking = true, lowOutputTokens = Some(48000)),
          requestTimeout = 600.seconds
        )
        _ <- IO.blocking {
          Files.createDirectories(directory)
          Files.writeString(
            marker,
            Json
              .obj("sourcePageId" -> page.id.asJson, "at" -> java.time.Instant.now.toString.asJson)
              .spaces2
          )
        }
        start <- IO.monotonic
        response <- client.complete(config, WebDocumentPrompt.designSystem, prompt, false).attempt
        result <- response
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
            record
              .deepMerge(
                Json.obj(
                  "effortPolicy" -> "experimental-low-capacity".asJson,
                  "originalError" -> record.hcursor.downField("error").focus.get,
                  "source" -> s"effort-guidance-v8-low/$label.json".asJson,
                  "databaseUnchanged" -> true.asJson,
                  "document" -> result.toOption.asJson,
                  "error" -> result.left.toOption.map(_.getMessage).asJson,
                  "seconds" -> (end - start).toSeconds.asJson,
                  "modelCalls" -> usage.asJson,
                  "attempts" -> List(
                    Json.obj(
                      "attempt" -> 1.asJson,
                      "outcome" -> (if result.isRight then "Accepted" else "Failed").asJson,
                      "output" -> response.toOption.asJson
                    )
                  ).asJson
                )
              )
              .spaces2
          )
        )
        _ <- IO.println(
          s"Low capacity $topic: accepted=${result.isRight}, calls=${usage.size}; original task unchanged"
        )
      yield ()
    }
