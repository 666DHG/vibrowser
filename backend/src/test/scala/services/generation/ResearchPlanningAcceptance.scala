package services.generation
import cats.effect.{IO, IOApp, Ref}
import io.circe.Json
import io.circe.parser.{parse, decode}
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import scala.concurrent.duration.*
import org.http4s.ember.client.EmberClientBuilder
import services.browser.objects.ResearchSnapshot
import services.generation.objects.ResearchPlan
import services.generation.utils.*
import services.settings.api.GetProviderConnectionMessage
import services.settings.tables.SettingsTable.SettingsTable
import services.system.DatabaseSession

/** One real planning call over saved sources; no Search/Fetch or database mutation. */
object ResearchPlanningAcceptance extends IOApp.Simple:
  def run: IO[Unit] =
    require(
      sys.env.get("VIBROWSER_PAID_PLANNING_ACCEPTANCE").contains("true"),
      "Paid opt-in required"
    )
    val directory = Paths.get("../.cache/product-research-planning")
    val output = directory.resolve("academic.json")
    val marker = directory.resolve("academic-started.json")
    require(!Files.exists(output) && !Files.exists(marker), "Existing planning request retained")
    val resources = for
      database <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=vibrowser_live",
        "vibrowser",
        ""
      )
      http <- EmberClientBuilder.default[IO].withTimeout(35.seconds).build
    yield (database, http)
    resources.use { (database, http) =>
      for
        record <- IO.fromEither(
          parse(
            Files.readString(Paths.get("../.cache/effort-acceptance/academic-new-standard.json"))
          )
        )
        snapshot <- IO.fromEither(record.hcursor.get[ResearchSnapshot]("research"))
        originalRequest <- IO.fromEither(
          parse(record.hcursor.get[String]("request").toOption.get.split("\n")(0))
        )
        address <- IO.fromEither(originalRequest.hcursor.downField("target").get[String]("address"))
        config <- database.transaction(c =>
          SettingsTable.get(c).flatMap(s => GetProviderConnectionMessage(s.revision).plan(c))
        )
        _ <- IO.raiseUnless(java.net.URI.create(config.baseUrl).getHost == "api.deepseek.com")(
          new IllegalArgumentException("Official provider required")
        )
        calls <- Ref.of[IO, Vector[Json]](Vector.empty)
        request = ResearchPlanPrompt.request(
          record.hcursor.get[String]("input").toOption.get,
          address,
          None,
          None,
          snapshot.sources
        )
        _ <- IO.blocking {
          Files.createDirectories(directory)
          Files.writeString(marker, java.time.Instant.now.toString)
        }
        start <- IO.monotonic
        result <- new DeepSeekCompatibleClient(EffortAcceptance.metered(http, calls))
          .complete(config, ResearchPlanPrompt.system, request, false)
          .timeout(30.seconds)
          .flatMap(text => IO.fromEither(decode[ResearchPlan](text)))
          .attempt
        end <- IO.monotonic
        usage <- calls.get
        _ <- IO.blocking(
          Files.writeString(
            output,
            Json
              .obj(
                "method" -> "Real product-standard planning call over saved source excerpts; no Search/Fetch, no page generation, no database writes".asJson,
                "sourcePageId" -> record.hcursor.downField("pageId").focus.get,
                "sourceCount" -> ResearchContent.boundedSources(snapshot.sources).size.asJson,
                "requestCharacters" -> request.length.asJson,
                "requestTimeoutSeconds" -> 30.asJson,
                "milliseconds" -> (end - start).toMillis.asJson,
                "plan" -> result.toOption.asJson,
                "error" -> result.left.toOption.map(_.getMessage).asJson,
                "modelCalls" -> usage.asJson
              )
              .spaces2
          )
        )
        _ <- IO.println(s"Planning accepted=${result.isRight}, calls=${usage.size}")
      yield ()
    }
