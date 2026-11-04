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
  test("concurrent navigate deduplicates; only bookmarked pages are reused") {
    isolated { db =>
      for
        responses <- List
          .fill(8)(db.transaction(NavigateMessage("cache.example", None).plan))
          .parSequence
        _ = assertEquals(responses.map(_.pageId).distinct.size, 1)
        _ = assertEquals(responses.map(_.jobId).distinct.size, 1)
        job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
        _ <- db.transaction(CompleteGenerationJobMessage(job.id, Some(spec), "mock").plan)
        fresh <- db.transaction(NavigateMessage("cache.example", None).plan)
        _ = assertNotEquals(fresh.pageId, job.pageId.get)
        _ <- db.transaction(SaveBookmarkMessage(job.pageId.get).plan)
        cached <- db.transaction(NavigateMessage("cache.example", None).plan)
        _ = assertEquals(cached.status, PageStatus.Ready)
        _ = assertEquals(cached.jobId, job.id)
        _ <- db.transaction(PageTable.clearTemporary)
        retained <- db.transaction(c => PageTable.findById(c, cached.pageId))
        removed <- db.transaction(c => PageTable.findById(c, fresh.pageId))
        _ = assert(retained.nonEmpty)
        _ = assertEquals(removed, None)
        _ <- db.transaction(PageTable.clearTemporary)
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
    List(("invalid", 2), ("exhausted", 2), ("auth", 1), ("quota", 1), ("timeout", 2), ("empty", 2))
      .traverse_ { case (scenario, expected) =>
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
                  else if scenario == "quota" then
                    IO.raiseError(AppError("provider_quota", "quota", 502))
                  else if scenario == "exhausted" then IO.pure("{invalid json")
                  else if scenario == "timeout" then
                    IO.raiseError(AppError("provider_timeout", "timeout", 504))
                  else if scenario == "empty" then
                    IO.raiseError(AppError("provider_content", "empty", 502))
                  else
                    IO.pure(
                      if n == 0 then "{invalid json"
                      else spec.copy(schemaVersion = 2).asJson.noSpaces
                    )
                }
            nav <- db.transaction(NavigateMessage(s"$scenario.example", None).plan)
            job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
            result <- new GenerationWorker(db, client, true).execute(job).attempt
            attempts <- count.get
            _ = assertEquals(attempts, expected)
            _ = assertEquals(result.isRight, scenario == "invalid")
            saved <- db.transaction(GetPageMessage(Some(nav.pageId), None).plan)
            steps = saved.job.get.steps
            _ = assertEquals(
              steps.take(3).map(_.phase),
              List(GenerationPhase.Queued, GenerationPhase.Preparing, GenerationPhase.Generating)
            )
            _ = assertEquals(steps.count(_.phase == GenerationPhase.Generating), expected)
            _ = assert(steps.forall(s => s.attempt >= 1 && s.attempt <= 2 && s.at.nonEmpty))
            _ = if scenario == "invalid" then
              assertEquals(
                steps.map(_.phase),
                List(
                  GenerationPhase.Queued,
                  GenerationPhase.Preparing,
                  GenerationPhase.Generating,
                  GenerationPhase.Validating,
                  GenerationPhase.Repairing,
                  GenerationPhase.Generating,
                  GenerationPhase.Validating,
                  GenerationPhase.Saving,
                  GenerationPhase.Ready
                )
              )
            _ = if scenario == "timeout" then
              assert(steps.exists(s => s.phase == GenerationPhase.Retrying && s.attempt == 2))
          yield ()
        }
      }
  }
  test("bookmarks reject pending pages, deduplicate concurrent saves and preserve cached content") {
    isolated { db =>
      for
        nav <- db.transaction(NavigateMessage("bookmark.example", None).plan)
        rejected <- db.transaction(SaveBookmarkMessage(nav.pageId).plan).attempt
        _ = assert(rejected.isLeft)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        _ <- db.transaction(CompleteGenerationJobMessage(nav.jobId, Some(spec), "mock").plan)
        saves <- List.fill(8)(db.transaction(SaveBookmarkMessage(nav.pageId).plan)).parSequence
        _ = assertEquals(saves.map(_.id).distinct.size, 1)
        _ = assertEquals(saves.map(_.savedAt).distinct.size, 1)
        _ = assertEquals(saves.head.title, spec.title)
        _ <- db.transaction(SchemaInitializer.initialize)
        _ <- db.transaction(SchemaInitializer.initialize)
        restored <- db.transaction(ListBookmarksMessage().plan)
        _ = assertEquals(restored.bookmarks, List(saves.head))
        isolatedSchema <- db.transaction { c =>
          SqlExecutor.update(c, "CREATE SCHEMA smoke_test_bookmark_isolation") *>
            SqlExecutor.update(c, "SET LOCAL search_path TO smoke_test_bookmark_isolation") *>
            SchemaInitializer.initialize(c) *>
            ListBookmarksMessage().plan(c).flatMap(list => IO(assertEquals(list.bookmarks, Nil))) *>
            IO.raiseError[Unit](new RuntimeException("rollback isolated test schema"))
        }.attempt
        _ = assertEquals(
          isolatedSchema.left.toOption.map(_.getMessage),
          Some("rollback isolated test schema")
        )
        removed <- db.transaction(RemoveBookmarkMessage(saves.head.id).plan)
        _ = assert(removed.removed)
        repeated <- db.transaction(RemoveBookmarkMessage(saves.head.id).plan)
        _ = assert(!repeated.removed)
        empty <- db.transaction(ListBookmarksMessage().plan)
        _ = assertEquals(empty.bookmarks, Nil)
        page <- db.transaction(GetPageMessage(Some(nav.pageId), None).plan)
        _ = assertEquals(page.page.get.spec, Some(spec))
        _ = assertEquals(page.page.get.currentJobId, nav.jobId)
      yield ()
    }
  }
  test(
    "progress migration retains old jobs without invented history and failure is recorded once"
  ) {
    isolated { db =>
      for
        nav <- db.transaction(NavigateMessage("old-progress.example", None).plan)
        _ <- db.transaction(c =>
          SqlExecutor
            .update(
              c,
              "UPDATE generation_jobs SET steps='[]'::jsonb WHERE id=?",
              List(nav.jobId.value)
            )
            .void
        )
        _ <- db.transaction(SchemaInitializer.initialize)
        old <- db.transaction(GetPageMessage(Some(nav.pageId), None).plan)
        _ = assertEquals(old.job.get.steps, Nil)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        _ <- db.transaction(SchemaInitializer.recover)
        _ <- db.transaction(SchemaInitializer.recover)
        stopped <- db.transaction(GetPageMessage(Some(nav.pageId), None).plan)
        _ = assertEquals(
          stopped.job.get.steps.map(_.phase),
          List(GenerationPhase.Preparing, GenerationPhase.Failed)
        )
      yield ()
    }
  }

  test("click snapshots persist across retry and conflicting entity facts get at most one repair") {
    List(false, true).traverse_ { keepConflict =>
      isolated { db =>
        val parentSpec = decode[PageSpec](
          Files.readString(Paths.get("../contracts/fixtures/valid/entities-list.json"))
        ).toOption.get
        val entity = parentSpec.entities.head
        val body = PageBlock(
          "body",
          BlockType.Article,
          None,
          Some("详情正文"),
          None,
          Nil,
          entityId = Some(entity.id)
        )
        val detail = PageSpec(
          2,
          "详情",
          "摘要",
          Theme.Paper,
          List(body),
          entities = List(entity),
          subjectEntityId = Some(entity.id)
        )
        for
          root <- db.transaction(NavigateMessage("moon-coffee.example", None).plan)
          _ <- db.transaction(ClaimGenerationJobMessage().plan)
          _ <- db.transaction(
            CompleteGenerationJobMessage(root.jobId, Some(parentSpec), "mock").plan
          )
          nav <- db.transaction(
            NavigateMessage(entity.id, Some(root.pageId), Some("thread-84458")).plan
          )
          before <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
          _ = assertEquals(before.navigationContext.get.entities.head, entity)
          _ <- db.transaction(SchemaInitializer.initialize)
          reread <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
          _ = assertEquals(reread.navigationContext, before.navigationContext)
          count <- Ref.of[IO, Int](0)
          client = new TextGenerationClient:
            def complete(
                config: ProviderConnection,
                system: String,
                prompt: String,
                test: Boolean
            ): IO[String] =
              count.getAndUpdate(_ + 1).map { n =>
                assert(prompt.contains("thread-84458"))
                (if n == 0 || keepConflict then
                   detail.copy(entities = List(entity.copy(replyCount = Some(2))))
                 else detail).asJson.noSpaces
              }
          job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
          result <- new GenerationWorker(db, client, true).execute(job).attempt
          attempts <- count.get
          _ = assertEquals(attempts, 2)
          _ = assertEquals(result.isLeft, keepConflict)
          saved <- db.transaction(GetPageMessage(Some(nav.pageId), None).plan)
          _ = assertEquals(saved.job.get.steps.count(_.phase == GenerationPhase.Repairing), 1)
          _ <-
            if keepConflict then
              for
                _ <- db.transaction(FailGenerationJobMessage(job.id, "事实冲突").plan)
                _ <- db.transaction(RetryPageMessage(nav.pageId, job.id).plan)
                retry <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
                _ = assertEquals(retry.navigationContext, before.navigationContext)
              yield ()
            else IO { assertEquals(saved.page.get.spec.get.entities.head.replyCount, Some(37)) }
          _ <-
            if keepConflict then IO.unit
            else db.transaction(SaveBookmarkMessage(nav.pageId).plan).void
          cached <- db.transaction(NavigateMessage(entity.id, None).plan)
          _ = assertEquals(cached.pageId, nav.pageId)
          unchanged <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
          _ = assertEquals(unchanged.navigationContext, before.navigationContext)
        yield ()
      }
    }
  }
