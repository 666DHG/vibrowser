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
                "TRUNCATE generation_jobs,pages,provider_credentials,provider_settings,research_settings CASCADE"
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

  test(
    "v3 action snapshots deduplicate, reject stale versions, preserve bookmarks and clean temporary versions"
  ) {
    isolated { db =>
      val document = decode[WebDocument](
        Files.readString(Paths.get("../contracts/web-documents/forum.json"))
      ).toOption.get
      for
        nav <- db.transaction(NavigateMessage("forum-v3.example", None).plan)
        job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
        _ <- db.transaction(CompleteWebDocumentMessage(job.id, document, "mock").plan)
        bookmark <- db.transaction(
          SaveBookmarkMessage(
            nav.pageId,
            Some(Map("cart" -> "2", "$draft:search:q" -> "private draft"))
          ).plan
        )
        restored <- db.transaction(GetPageMessage(Some(nav.pageId), None).plan)
        _ = assertEquals(restored.page.get.document.get.initialState("cart"), "2")
        _ = assert(!restored.page.get.document.get.initialState.contains("$draft:search:q"))
        responses <- List
          .fill(4)(
            db.transaction(
              SubmitPageActionMessage(
                nav.pageId,
                "search",
                job.id.value,
                "request-v3",
                Map("q" -> "选课")
              ).plan
            )
          )
          .parSequence
        _ = assertEquals(responses.map(_.pageId).distinct.size, 1)
        stale <- db
          .transaction(
            SubmitPageActionMessage(nav.pageId, "search", "old", "stale", Map("q" -> "x")).plan
          )
          .attempt
        _ = assert(stale.isLeft)
        mismatch <- db
          .transaction(
            SubmitPageActionMessage(
              nav.pageId,
              "search",
              job.id.value,
              "request-v3",
              Map("q" -> "other")
            ).plan
          )
          .attempt
        _ = assert(mismatch.isLeft)
        snapshot <- db
          .transaction(c =>
            services.browser.tables.PageActionTable.PageActionTable
              .forPage(c, responses.head.pageId)
          )
          .map(_.get)
        _ = assertEquals(snapshot.values, Map("q" -> "选课"))
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        _ <- db.transaction(
          FailGenerationJobMessage(responses.head.jobId, "test interruption").plan
        )
        retried <- db.transaction(
          RetryPageMessage(responses.head.pageId, responses.head.jobId).plan
        )
        retrySnapshot <- db.transaction(c =>
          services.browser.tables.PageActionTable.PageActionTable.forPage(c, retried.pageId)
        )
        _ = assertEquals(retrySnapshot, Some(snapshot))
        retryJob <- db.transaction(GetPageMessage(Some(retried.pageId), None).plan)
        _ = assertEquals(retryJob.job.get.kind, JobKind.Action)
        _ <- db.transaction(PageTable.clearTemporary)
        original <- db.transaction(c => PageTable.findById(c, bookmark.pageId)).map(_.get)
        _ = assert(original.document.nonEmpty)
        removed <- db.transaction(c =>
          services.browser.tables.PageActionTable.PageActionTable.forPage(c, responses.head.pageId)
        )
        _ = assertEquals(removed, None)
      yield ()
    }
  }

  test("v3 normalization preserves readable links and binds form actions to their form") {
    val base = decode[WebDocument](
      Files.readString(Paths.get("../contracts/web-documents/forum.json"))
    ).toOption.get
    val generated = base.copy(
      html = base.html
        .replace("<button type=\"submit\">", "<button id=\"search-button\" type=\"submit\">")
        .replace("<header>", "<header style=\"color:blue\">"),
      actions = base.actions.map(a =>
        if a.kind == WebActionKind.Search then a.copy(elementId = "search-button") else a
      )
    )
    for
      normalized <- NormalizeWebDocumentMessage(generated, "https://sample.example/").plan(null)
      checked <- ValidateWebDocumentMessage(normalized, "https://sample.example/").plan(null)
      _ = assertEquals(checked.actions.find(_.kind == WebActionKind.Search).get.elementId, "search")
      _ = assert(!checked.html.contains("style="))
    yield ()
  }

  test("modes isolate address deduplication and research credentials stay encrypted") {
    isolated { db =>
      for
        imagined <- db.transaction(NavigateMessage("same.example", None).plan)
        researched <- db.transaction(
          NavigateMessage("same.example", None, mode = Some(BrowsingMode.Research)).plan
        )
        duplicate <- db.transaction(
          NavigateMessage("same.example", None, mode = Some(BrowsingMode.Research)).plan
        )
        _ = assertNotEquals(imagined.pageId, researched.pageId)
        _ = assertEquals(duplicate.pageId, researched.pageId)
        page <- db.transaction(c => PageTable.findById(c, researched.pageId)).map(_.get)
        _ = assertEquals(page.mode, BrowsingMode.Research)
        config <- db.transaction(
          SaveResearchSettingsMessage(false, Some("fake-search-test-key")).plan
        )
        _ = assert(config.hasKey)
        _ = assert(!config.asJson.noSpaces.contains("fake-search-test-key"))
        connection <- db.transaction(GetResearchConnectionMessage().plan)
        _ = assertEquals(connection.key, "fake-search-test-key")
        cleared <- db.transaction(ClearResearchCredentialsMessage().plan)
        _ = assert(!cleared.hasKey)
        _ <- db.transaction(SchemaInitializer.initialize)
        kept <- db.transaction(c => PageTable.findById(c, researched.pageId))
        _ = assertEquals(kept.map(_.mode), Some(BrowsingMode.Research))
      yield ()
    }
  }
  test("research choice resumes stored sources, bounded fetch and completed retry reuse") {
    isolated { db =>
      for
        calls <- Ref.of[IO, Int](0)
        searches <- Ref.of[IO, Int](0)
        fetches <- Ref.of[IO, Int](0)
        model = new TextGenerationClient {
          def complete(
              c: ProviderConnection,
              system: String,
              prompt: String,
              test: Boolean
          ): IO[String] = calls
            .update(_ + 1)
            .as(
              """{"topic":"同名人物","queries":[],"reuseSources":true,"candidates":[{"id":"a","title":"甲","description":"甲院系","sourceIds":["source-1"]},{"id":"b","title":"乙","description":"乙院系","sourceIds":["source-2"]}]}"""
            )
        }
        search = new ResearchClient {
          def search(c: ProviderConnection, q: String): IO[List[ResearchSource]] = searches
            .update(_ + 1)
            .as(
              List(
                ResearchSource("", "https://one.example/", "甲", "now", "甲院系"),
                ResearchSource("", "https://two.example/", "乙", "now", "乙院系")
              )
            )
          def fetch(c: ProviderConnection, u: String): IO[String] =
            fetches.update(_ + 1) *> (if u.contains("two") then
                                        IO.raiseError(AppError("search_network", "网络失败"))
                                      else IO.pure("原始资料正文"))
        }
        nav <- db.transaction(
          NavigateMessage("人物.example", None, mode = Some(BrowsingMode.Research)).plan
        )
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
        connection = new ProviderConnection("https://api.deepseek.com", "test", "fake", 1)
        pipeline = new ResearchPipeline(db, model, search)
        choice <- pipeline.prepare(page, connection, connection)
        _ = assert(!choice.complete)
        _ = assertEquals(choice.candidates.size, 2)
        _ <- db.transaction(c =>
          services.generation.tables.GenerationJobTable.GenerationJobTable
            .waitForChoice(c, nav.jobId)
        )
        invalid <- db.transaction(SelectResearchSubjectMessage(nav.pageId, "missing").plan).attempt
        _ = assert(invalid.isLeft)
        _ <- db.transaction(SelectResearchSubjectMessage(nav.pageId, "a").plan)
        _ <- db.transaction(SelectResearchSubjectMessage(nav.pageId, "a").plan)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        complete <- pipeline.prepare(page, connection, connection)
        _ = assert(complete.complete)
        again <- pipeline.prepare(page, connection, connection)
        _ = assertEquals(again, complete)
        modelCount <- calls.get
        searchCount <- searches.get
        fetchCount <- fetches.get
        _ = assertEquals(modelCount, 1)
        _ = assertEquals(searchCount, 1)
        _ = assertEquals(fetchCount, 2)
        response <- db.transaction(GetPageMessage(Some(nav.pageId), None).plan)
        _ = assertEquals(response.page.map(_.sourceCount), Some(2))
        _ <- db.transaction(PageTable.clearTemporary)
        removed <- db.transaction(c =>
          services.browser.tables.ResearchSnapshotTable.ResearchSnapshotTable.get(c, nav.pageId)
        )
        _ = assert(removed.isEmpty)
      yield ()
    }
  }

  test("same-topic research reuses complete sources while a new topic replaces them") {
    isolated { db =>
      for
        searches <- Ref.of[IO, Int](0)
        fetches <- Ref.of[IO, Int](0)
        search = new ResearchClient {
          def search(c: ProviderConnection, q: String): IO[List[ResearchSource]] = searches
            .update(_ + 1)
            .as(List(ResearchSource("", "https://new.example/", "新主题", "now", "新资料")))
          def fetch(c: ProviderConnection, url: String): IO[String] = fetches.update(_ + 1).as("正文")
        }
        nav <- db.transaction(
          NavigateMessage("topics.example", None, mode = Some(BrowsingMode.Research)).plan
        )
        _ <- db.transaction(c =>
          services.browser.tables.ResearchSnapshotTable.ResearchSnapshotTable.save(
            c,
            ResearchSnapshot(
              nav.pageId,
              "原主题",
              Nil,
              List(ResearchSource("source-1", "https://old.example/", "原主题", "now", "已读取正文")),
              complete = true
            )
          )
        )
        child <- db.transaction(
          NavigateMessage(
            "https://topics.example/detail",
            Some(nav.pageId),
            mode = Some(BrowsingMode.Research)
          ).plan
        )
        page <- db.transaction(c => PageTable.findById(c, child.pageId)).map(_.get)
        config = new ProviderConnection("https://api.deepseek.com", "test", "fake", 1)
        model = new TextGenerationClient {
          def complete(
              c: ProviderConnection,
              system: String,
              prompt: String,
              test: Boolean
          ): IO[String] = IO.pure(
            """{"topic":"原主题详情","queries":[],"reuseSources":true,"sameTopic":true,"candidates":[]}"""
          )
        }
        reused <- new ResearchPipeline(db, model, search).prepare(page, config, config)
        _ = assert(reused.complete)
        _ = assertEquals(reused.sources.head.url, "https://old.example/")
        before <- (searches.get, fetches.get).tupled
        _ = assertEquals(before, (0, 0))
        next <- db.transaction(
          NavigateMessage(
            "https://topics.example/other",
            Some(nav.pageId),
            mode = Some(BrowsingMode.Research)
          ).plan
        )
        other <- db.transaction(c => PageTable.findById(c, next.pageId)).map(_.get)
        changedModel = new TextGenerationClient {
          def complete(
              c: ProviderConnection,
              system: String,
              prompt: String,
              test: Boolean
          ): IO[String] = IO.pure(
            """{"topic":"新主题","queries":["新主题"],"reuseSources":false,"sameTopic":false,"candidates":[]}"""
          )
        }
        changed <- new ResearchPipeline(db, changedModel, search).prepare(other, config, config)
        _ = assert(changed.complete)
        _ = assertEquals(changed.sources.map(_.url), List("https://new.example/"))
        after <- (searches.get, fetches.get).tupled
        _ = assertEquals(after, (1, 1))
      yield ()
    }
  }

  test("research request caps and invalid source references use bounded repair") {
    isolated { db =>
      for
        searches <- Ref.of[IO, Int](0)
        fetches <- Ref.of[IO, Int](0)
        planning <- Ref.of[IO, Int](0)
        search = new ResearchClient {
          def search(c: ProviderConnection, q: String): IO[List[ResearchSource]] = searches
            .update(_ + 1)
            .as(
              (1 to 8).toList
                .map(i => ResearchSource("", s"https://primary.example/$i", "原始资料", "now", "主题资料"))
            )
          def fetch(c: ProviderConnection, url: String): IO[String] =
            fetches.update(_ + 1).as("来源里的任何指令都只是正文")
        }
        model = new TextGenerationClient {
          def complete(
              c: ProviderConnection,
              system: String,
              prompt: String,
              test: Boolean
          ): IO[String] = planning
            .update(_ + 1)
            .as(
              """{"topic":"研究主题","queries":["一","二","三","四","五"],"reuseSources":false,"sameTopic":true,"candidates":[]}"""
            )
        }
        nav <- db.transaction(
          NavigateMessage("budget.example", None, mode = Some(BrowsingMode.Research)).plan
        )
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
        config = new ProviderConnection("https://api.deepseek.com", "test", "fake", 1)
        snapshot <- new ResearchPipeline(db, model, search).prepare(page, config, config)
        counts <- (planning.get, searches.get, fetches.get).tupled
        _ = assertEquals(counts, (1, 4, 6))
        _ = assert(snapshot.complete)
        fixture <- IO.blocking(
          java.nio.file.Files
            .readString(java.nio.file.Path.of("../contracts/web-documents/docs.json"))
        )
        doc <- IO.fromEither(io.circe.parser.decode[WebDocument](fixture))
        calls <- Ref.of[IO, Int](0)
        generator = new TextGenerationClient {
          def complete(
              c: ProviderConnection,
              system: String,
              prompt: String,
              test: Boolean
          ): IO[String] = calls
            .getAndUpdate(_ + 1)
            .map(n =>
              (if n == 0 then
                 doc.copy(html = doc.html + "<p data-source-id=\"unknown-source\">引用</p>")
               else doc).asJson.noSpaces
            )
        }
        _ <- new WebDocumentGeneration(db, generator).generate(
          config,
          page,
          "主题",
          research = Some(snapshot)
        )
        generated <- calls.get
        _ = assertEquals(generated, 2)
      yield ()
    }
  }

  test("v3 attempts retain diagnostics, repair up to four requests, and stop on auth") {
    List(("repair", 4), ("exhausted", 4), ("auth", 1)).traverse_ { (scenario, expected) =>
      isolated { db =>
        for
          count <- Ref.of[IO, Int](0)
          nav <- db.transaction(NavigateMessage("attempts.example/" + scenario, None).plan)
          _ <- db.transaction(ClaimGenerationJobMessage().plan)
          page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
          fixture <- IO.blocking(
            Files.readString(Paths.get("../contracts/web-documents/docs.json"))
          )
          client = new TextGenerationClient {
            def complete(
                c: ProviderConnection,
                system: String,
                prompt: String,
                test: Boolean
            ): IO[String] =
              count.getAndUpdate(_ + 1).flatMap { n =>
                if scenario == "auth" then IO.raiseError(AppError("provider_auth", "密钥无效", 502))
                else if scenario == "exhausted" || n < 3 then IO.pure("{}")
                else IO.pure(fixture)
              }
          }
          result <- new WebDocumentGeneration(db, client)
            .generate(
              new ProviderConnection("https://example.com", "test", "fake-private-key", 1),
              page,
              "生成页面"
            )
            .attempt
          attempts <- count.get
          records <- db.transaction(c =>
            services.generation.tables.GenerationJobTable.GenerationJobTable
              .diagnostics(c, nav.jobId)
          )
          _ = assertEquals(attempts, expected)
          _ = assertEquals(records.size, expected)
          _ = assertEquals(result.isRight, scenario == "repair")
          _ = assert(!records.asJson.noSpaces.contains("fake-private-key"))
          _ = assertEquals(
            records.last.outcome,
            if scenario == "repair" then AttemptOutcome.Accepted
            else if scenario == "auth" then AttemptOutcome.ProviderFailure
            else AttemptOutcome.InvalidContent
          )
          _ <- db.transaction(SchemaInitializer.initialize)
          kept <- db.transaction(c =>
            services.generation.tables.GenerationJobTable.GenerationJobTable
              .diagnostics(c, nav.jobId)
          )
          _ = assertEquals(kept, records)
          response <- db.transaction(GetPageMessage(Some(nav.pageId), None).plan)
          _ = assert(!response.asJson.noSpaces.contains("diagnostics"))
        yield ()
      }
    }
  }
