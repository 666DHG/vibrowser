package services.generation
import cats.effect.{IO, IOApp}
import cats.syntax.all.*
import java.nio.file.{Files, Paths}
import org.http4s.ember.client.EmberClientBuilder
import io.circe.parser.decode
import services.system.DatabaseSession
import services.settings.api.{GetSettingsMessage, GetProviderConnectionMessage}
import services.browser.objects.PageSpec
import services.browser.tables.PageTable.PageTable
import services.generation.utils.{DeepSeekCompatibleClient, PromptBuilder}

/** Explicit manual diagnostic: makes one billable call; never runs as part of test. */
object LiveProviderProbe extends IOApp.Simple:
  def run: IO[Unit] =
    IO.raiseUnless(sys.env.get("VIBROWSER_LIVE_PROBE").contains("true"))(
      new IllegalStateException("Set VIBROWSER_LIVE_PROBE=true to authorize one live call")
    ) *> DatabaseSession
      .resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=vibrowser_live",
        "vibrowser",
        ""
      )
      .use { database =>
        EmberClientBuilder.default[IO].build.use { client =>
          for
            settings <- database.transaction(GetSettingsMessage().plan)
            config <- database.transaction(GetProviderConnectionMessage(settings.revision).plan)
            page <- database
              .transaction(c =>
                PageTable.findByAddress(
                  c,
                  sys.env.getOrElse("VIBROWSER_PROBE_ADDRESS", "https://moon-coffee.example/")
                )
              )
              .flatMap(
                IO.fromOption(_)(new IllegalStateException("Navigate to the probe address first"))
              )
            text <- new DeepSeekCompatibleClient(client).complete(
              config,
              PromptBuilder.system,
              PromptBuilder.request(page),
              false
            )
            _ <- IO.blocking(
              Files.writeString(Paths.get("../.data/live-provider-response.json"), text)
            )
            _ <- IO.println(
              decode[PageSpec](text).fold(
                e => "PageSpec decode failed: " + e.toString,
                p => s"PageSpec decoded: top-level blocks=${p.blocks.size}"
              )
            )
            _ <- IO.println(
              "Model response saved only to ignored .data/live-provider-response.json; no credential exported."
            )
          yield ()
        }
      }
