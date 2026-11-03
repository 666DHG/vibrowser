package services.generation
import munit.CatsEffectSuite
import cats.effect.{IO, Ref}
import cats.syntax.all.*
import java.nio.file.{Files, Paths}
import io.circe.parser.decode
import io.circe.syntax.*
import services.system.{DatabaseSession, SchemaInitializer, SqlExecutor}
import services.system.objects.AppError
import services.browser.api.*
import services.browser.objects.*
import services.browser.tables.PageTable.PageTable
import services.generation.api.*
import services.generation.objects.*
import services.generation.utils.*
import services.settings.api.*
import services.settings.objects.ProviderConnection
class IntegrationSuite extends CatsEffectSuite:
  private def isolated[A](test: DatabaseSession => IO[A]): IO[A] =
    DatabaseSession
      .resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=smoke_test",
        "vibrowser",
        ""
      )
      .use { db =>
        db.transaction(c =>
          SqlExecutor.update(c, "CREATE SCHEMA IF NOT EXISTS smoke_test") *>
            SchemaInitializer.initialize(c) *>
            SqlExecutor
              .update(
                c,
                "TRUNCATE generation_jobs,pages,provider_credentials,provider_settings CASCADE"
              )
              .void *>
            SchemaInitializer.initialize(c)
        ) *> test(db)
      }
  private val fixture = Files.readString(Paths.get("../contracts/fixtures/valid/moon-coffee.json"))
  private val spec = decode[PageSpec](fixture).toOption.get
  test("concurrent navigate deduplicates; completed page is cached") {
    isolated { db =>
      for
        responses <- List
          .fill(8)(db.transaction(NavigateMessage("cache.example", None).plan))
          .parSequence
        _ = assertEquals(responses.map(_.pageId).distinct.size, 1)
        _ = assertEquals(responses.map(_.jobId).distinct.size, 1)
        job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
        _ <- db.transaction(CompleteGenerationJobMessage(job.id, Some(spec), "mock").plan)
        cached <- db.transaction(NavigateMessage("cache.example", None).plan)
        _ = assertEquals(cached.status, PageStatus.Ready)
        _ = assertEquals(cached.jobId, job.id)
      yield ()
    }
  }
  test("rollback leaves no page; duplicate retry creates one job; stale result cannot overwrite") {
    isolated { db =>
      for
        _ <- db
          .transaction(c =>
            NavigateMessage("rollback.example", None).plan(c) *> IO.raiseError(
              new RuntimeException("rollback")
            )
          )
          .attempt
        absent <- db.transaction(c => PageTable.findByAddress(c, "https://rollback.example/"))
        _ = assertEquals(absent, None)
        nav <- db.transaction(NavigateMessage("retry.example", None).plan)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        _ <- db.transaction(FailGenerationJobMessage(nav.jobId, "expected failure").plan)
        retries <- List
          .fill(5)(db.transaction(RetryPageMessage(nav.pageId, nav.jobId).plan))
          .parSequence
        _ = assertEquals(retries.map(_.jobId).distinct.size, 1)
        _ <- db.transaction(CompleteGenerationJobMessage(nav.jobId, Some(spec), "mock").plan)
        stillGenerating <- db.transaction(GetPageMessage(Some(nav.pageId), None).plan)
        _ = assertEquals(stillGenerating.page.get.status, PageStatus.Generating)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        _ <- db.transaction(SchemaInitializer.recover)
        interrupted <- db.transaction(GetPageMessage(Some(nav.pageId), None).plan)
        _ = assertEquals(interrupted.page.get.status, PageStatus.Failed)
      yield ()
    }
  }
  test(
    "settings are encrypted, redacted, address changes require a new key, and clearing persists"
  ) {
    isolated { db =>
      for
        saved <- db.transaction(
          SaveSettingsMessage(
            "https://api.deepseek.com",
            "deepseek-flash",
            Some("smoke-fake-key")
          ).plan
        )
        _ = assert(saved.hasKey)
        _ = assert(!saved.asJson.noSpaces.contains("smoke-fake-key"))
        rejected <- db
          .transaction(SaveSettingsMessage("https://another.example/v1", "model", None).plan)
          .attempt
        _ = assert(rejected.isLeft)
        connection <- db.transaction(GetProviderConnectionMessage(saved.revision).plan)
        _ = assertEquals(connection.key, "smoke-fake-key")
        _ = assert(!connection.toString.contains("smoke-fake-key"))
        _ <- db.transaction(ClearCredentialsMessage().plan)
        empty <- db.transaction(GetSettingsMessage().plan)
        _ = assert(!empty.hasKey)
      yield ()
    }
  }
  test("one repair for invalid content, none for authentication, two total for network/timeouts") {
    List(("invalid", 2), ("auth", 1), ("timeout", 2), ("empty", 2)).traverse_ {
      case (scenario, expected) =>
        isolated { db =>
          for
            count <- Ref.of[IO, Int](0)
            client = new TextGenerationClient:
              def complete(
                  config: ProviderConnection,
                  system: String,
                  prompt: String,
                  test: Boolean
              ): IO[String] =
                count.getAndUpdate(_ + 1).flatMap { n =>
                  if scenario == "auth" then IO.raiseError(AppError("provider_auth", "auth", 502))
                  else if scenario == "timeout" then
                    IO.raiseError(AppError("provider_timeout", "timeout", 504))
                  else if scenario == "empty" then
                    IO.raiseError(AppError("provider_content", "empty", 502))
                  else IO.pure(if n == 0 then "{}" else fixture)
                }
            nav <- db.transaction(NavigateMessage(s"$scenario.example", None).plan)
            job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
            result <- new GenerationWorker(db, client, true).execute(job).attempt
            attempts <- count.get
            _ = assertEquals(attempts, expected)
            _ = assertEquals(result.isRight, scenario == "invalid")
          yield ()
        }
    }
  }
