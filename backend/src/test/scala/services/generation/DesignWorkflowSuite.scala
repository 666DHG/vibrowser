package services.generation
import munit.CatsEffectSuite
import cats.effect.{IO, Ref}
import cats.syntax.all.*
import io.circe.parser.decode
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import services.system.{DatabaseSession, SchemaInitializer, SqlExecutor}
import services.system.objects.AppError
import services.browser.api.*
import services.browser.objects.*
import services.browser.tables.PageTable.PageTable
import services.generation.api.*
import services.generation.objects.*
import services.generation.utils.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.settings.objects.ProviderConnection
import scala.concurrent.duration.*
class DesignWorkflowSuite extends CatsEffectSuite:
  private val fixture = decode[WebDocument](
    Files.readString(Paths.get("../contracts/web-documents/docs.json"))
  ).toOption.get
  private val brief =
    DesignBrief("阅读", "查找内容", List("正文"), "围绕内容自由组织", "中文排版", List("检索"), "继承站点", "内容关系决定阅读顺序")
  private val review = DesignReview(List(DesignIssue("main", "正文过窄", "阅读频繁换行", "调整行宽")))
  private val report = LayoutReport(
    List(390, 1440).map(w => LayoutViewport(w, 844, w, 900, Nil, Nil, Nil, Nil))
  )
  private val config = new ProviderConnection("https://mock.invalid", "test", "secret", 1)
  test("layout scroll context survives encoding while historical measurements remain readable") {
    val element = LayoutElement(
      "link",
      "a",
      "Next",
      500,
      0,
      80,
      20,
      "16px",
      "20px",
      "serif",
      Some(LayoutScrollContext("nav", 300, 800, 20, 320))
    )
    assertEquals(element.asJson.as[LayoutElement], Right(element))
    val old = element.asJson.mapObject(_.remove("horizontalScroll"))
    assertEquals(old.as[LayoutElement], Right(element.copy(horizontalScroll = None)))
  }
  test("compact intent and saved visual briefs both decode without losing old fields") {
    val compact = brief.asJson.mapObject(_.remove("typography").remove("continuity"))
    assertEquals(compact.as[DesignBrief].toOption.get.typography, "")
    assertEquals(compact.as[DesignBrief].toOption.get.continuity, "")
    assertEquals(brief.asJson.as[DesignBrief], Right(brief))
    assertEquals(
      decode[DesignGuidanceText](
        """{"version":"3-old","design":"d","review":"r"}"""
      ).toOption.get.intent,
      None
    )
  }
  private def isolated[A](f: DatabaseSession => IO[A]): IO[A] =
    DatabaseSession
      .resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=design_test",
        "vibrowser",
        ""
      )
      .use { db =>
        db.transaction(c =>
          SqlExecutor.update(c, "CREATE SCHEMA IF NOT EXISTS design_test") *> SchemaInitializer
            .initialize(c) *>
            SqlExecutor
              .update(
                c,
                "TRUNCATE generation_jobs,pages,provider_credentials,provider_settings,research_settings CASCADE"
              )
              .void *> SchemaInitializer.initialize(c)
        ) *> f(db)
      }
  private def meter(result: LayoutReport = report): LayoutMeasurer = new LayoutMeasurer:
    def measure(doc: WebDocument): IO[LayoutReport] = IO.pure(result)
  test("comparison guidance is used in planning, generation and review and its version is saved") {
    isolated { db =>
      for
        calls <- Ref.of[IO, Int](0)
        nav <- db.transaction(NavigateMessage("guidance-comparison.example", None).plan)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
        client = new TextGenerationClient:
          def complete(
              c: ProviderConnection,
              system: String,
              prompt: String,
              test: Boolean
          ): IO[String] =
            calls.getAndUpdate(_ + 1).map {
              case 0 =>
                assert(system.contains("test-design-marker"))
                brief.asJson.noSpaces
              case 1 =>
                assert(prompt.contains("test-design-marker"))
                fixture.asJson.noSpaces
              case 2 =>
                assert(system.contains("test-review-marker"))
                DesignReview(Nil).asJson.noSpaces
              case _ => fail("unexpected extra model call")
            }
        _ <- new DesignWorkflowGeneration(
          db,
          client,
          meter(),
          guidance = DesignGuidanceText("test-version", "test-design-marker", "test-review-marker")
        )
          .generate(config, page, "input", None, None)
        saved <- db.transaction(c => GenerationJobTable.designWorkflow(c, nav.jobId)).map(_.get)
        _ = assertEquals(saved.guidanceVersion, "test-version")
      yield ()
    }
  }
  test("content planning leaves visual decisions to generation and preserves source context") {
    isolated { db =>
      for
        calls <- Ref.of[IO, Int](0)
        nav <- db.transaction(NavigateMessage("intent-only.example", None).plan)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
        client = new TextGenerationClient:
          def complete(
              c: ProviderConnection,
              system: String,
              prompt: String,
              test: Boolean
          ): IO[String] =
            calls.getAndUpdate(_ + 1).map {
              case 0 =>
                assert(system.contains("content-intent-marker"))
                assert(!system.contains("visual-design-marker"))
                assert(!system.contains(WebDocumentPrompt.actionContract))
                assert(prompt.contains("inherited-context-marker"))
                brief.asJson.noSpaces
              case 1 =>
                assert(prompt.contains("visual-design-marker"))
                assert(prompt.contains("inherited-context-marker"))
                assert(!prompt.contains("中文排版"))
                fixture.asJson.noSpaces
              case 2 => DesignReview(Nil).asJson.noSpaces
              case _ => fail("unexpected extra model call")
            }
        _ <- new DesignWorkflowGeneration(
          db,
          client,
          meter(),
          guidance = DesignGuidanceText(
            "4-test",
            "visual-design-marker",
            "review-marker",
            Some("content-intent-marker")
          )
        )
          .generate(config, page, "inherited-context-marker", None, None)
        saved <- db.transaction(c => GenerationJobTable.designWorkflow(c, nav.jobId)).map(_.get)
        _ = assertEquals(saved.brief.map(_.typography), Some(""))
        _ <- calls.get.map(n => assertEquals(n, 3))
      yield ()
    }
  }
  test(
    "generation, repair and refinement send one complete action contract without user duplication"
  ) {
    isolated { db =>
      for
        calls <- Ref.of[IO, Int](0)
        nav <- db.transaction(NavigateMessage("single-contract.example", None).plan)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
        client = new TextGenerationClient:
          def complete(
              c: ProviderConnection,
              system: String,
              prompt: String,
              test: Boolean
          ): IO[String] =
            calls.getAndUpdate(_ + 1).map { index =>
              if Set(1, 2, 4)(index) then
                assert(
                  system.contains(WebDocumentPrompt.system.linesIterator.drop(1).mkString("\n"))
                )
                assert(!system.contains("生成完整的中文网站"))
                assert(system.contains(WebDocumentPrompt.actionLimitations))
                assertEquals(
                  (system + prompt).sliding("Copy: 绑定 button".length).count(_ == "Copy: 绑定 button"),
                  1
                )
                assert(!prompt.contains(WebDocumentPrompt.actionContract))
                assert(prompt.contains("source-context-marker"))
              index match
                case 0 => brief.asJson.noSpaces
                case 1 => "{}"
                case 2 => fixture.asJson.noSpaces
                case 3 => review.asJson.noSpaces
                case 4 => fixture.asJson.noSpaces
                case _ => fail("unexpected model request")
            }
        result <- new DesignWorkflowGeneration(db, client, meter()).generate(
          config,
          page,
          "source-context-marker",
          None,
          None
        )
        _ = assertEquals(result.title, fixture.title)
        _ <- calls.get.map(n => assertEquals(n, 5))
      yield ()
    }
  }
  test("worker supplies the persisted page effort to generation") {
    isolated { db =>
      val client = new TextGenerationClient:
        def complete(
            c: ProviderConnection,
            system: String,
            prompt: String,
            test: Boolean
        ): IO[String] = IO {
          assertEquals(c.effort, GenerationEffort.Deep)
          fixture.asJson.noSpaces
        }
      for
        nav <- db.transaction(
          NavigateMessage("worker-effort.example", None, effort = Some(GenerationEffort.Deep)).plan
        )
        job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
        _ <- new GenerationWorker(db, client, mock = true, webDocuments = true).execute(job)
        page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
        _ = assertEquals(page.status, PageStatus.Ready)
      yield ()
    }
  }
  test(
    "effort isolates queued pages, survives migration and is inherited by temporary versions and retry"
  ) {
    isolated { db =>
      for
        standard <- db.transaction(NavigateMessage("effort.example", None).plan)
        deep <- db.transaction(
          NavigateMessage("effort.example", None, effort = Some(GenerationEffort.Deep)).plan
        )
        duplicate <- db.transaction(
          NavigateMessage("effort.example", None, effort = Some(GenerationEffort.Deep)).plan
        )
        _ = assertNotEquals(standard.pageId, deep.pageId)
        _ = assertEquals(deep.pageId, duplicate.pageId)
        _ <- db.transaction(SchemaInitializer.initialize)
        saved <- db.transaction(c => PageTable.findById(c, deep.pageId)).map(_.get)
        _ = assertEquals(saved.effort, GenerationEffort.Deep)
        versionId = PageId(java.util.UUID.randomUUID().toString)
        _ <- db.transaction(c =>
          PageTable.insertVersion(
            c,
            versionId,
            VirtualAddress(saved.address, saved.kind, saved.prompt),
            JobId(java.util.UUID.randomUUID().toString),
            saved
          )
        )
        version <- db.transaction(c => PageTable.findById(c, versionId)).map(_.get)
        _ = assertEquals(version.effort, GenerationEffort.Deep)
        _ <- db.transaction(FailGenerationJobMessage(deep.jobId, "retry").plan)
        retry <- db.transaction(RetryPageMessage(deep.pageId, deep.jobId).plan)
        retried <- db.transaction(c => PageTable.findById(c, retry.pageId)).map(_.get)
        _ = assertEquals(retried.effort, GenerationEffort.Deep)
      yield ()
    }
  }
  private def provider(
      outputs: List[Either[Throwable, String]],
      count: Ref[IO, Int]
  ): TextGenerationClient = new TextGenerationClient:
    def complete(c: ProviderConnection, system: String, prompt: String, test: Boolean): IO[String] =
      count
        .getAndUpdate(_ + 1)
        .flatMap(n =>
          IO.fromEither(outputs.lift(n).getOrElse(Left(new Exception("unexpected extra request"))))
        )
  test(
    "guidance resources are packaged, versioned and validation preserves required content and actions"
  ) {
    assert(DesignGuidance.version.startsWith("5-"))
    assert(
      DesignGuidance.design.nonEmpty && DesignGuidance.review.nonEmpty && DesignGuidance.intent.nonEmpty
    )
    assert(
      DesignPreservation
        .issues(fixture, fixture.copy(css = fixture.css + "\nmain{max-width:70rem}"))
        .isEmpty
    )
    assert(DesignPreservation.issues(fixture, fixture.copy(actions = Nil)).nonEmpty)
    assert(DesignPreservation.issues(fixture, fixture.copy(html = "<h1>删掉正文</h1>")).nonEmpty)
    assert(
      DesignPreservation.layoutWorsened(
        report,
        report.copy(viewports = report.viewports.map(_.copy(overflowIds = List("wide"))))
      )
    )
  }
  test(
    "design, review and one refinement preserve the candidate and survive repeat execution without paid calls"
  ) {
    isolated { db =>
      for
        count <- Ref.of[IO, Int](0)
        nav <- db.transaction(NavigateMessage("design.example", None).plan)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
        improved = fixture.copy(css = fixture.css + "\nmain{max-width:70rem}")
        client = provider(
          List(
            brief.asJson.noSpaces,
            fixture.asJson.noSpaces,
            review.asJson.noSpaces,
            improved.asJson.noSpaces
          ).map(Right(_)),
          count
        )
        workflow = new DesignWorkflowGeneration(db, client, meter())
        result <- workflow.generate(config, page, "内容", None, None)
        saved <- db.transaction(c => GenerationJobTable.designWorkflow(c, nav.jobId)).map(_.get)
        _ = assertEquals(saved.selection, DesignSelection.Improved)
        _ = assert(result.css.contains("70rem"))
        _ <- db.transaction(SchemaInitializer.initialize)
        again <- workflow.generate(config, page, "内容", None, None)
        calls <- count.get
        _ = assertEquals(calls, 4)
        _ = assertEquals(again, result)
        response <- db.transaction(GetPageMessage(Some(page.id), None).plan)
        _ = assert(!response.asJson.noSpaces.contains("design_workflow"))
        _ <- db.transaction(FailGenerationJobMessage(nav.jobId, "interrupted").plan)
        retry <- db.transaction(RetryPageMessage(page.id, nav.jobId).plan)
        copied <- db.transaction(c => GenerationJobTable.designWorkflow(c, retry.jobId))
        _ = assertEquals(copied, Some(saved))
        stale <- db.transaction(SaveDesignWorkflowMessage(nav.jobId, saved).plan).attempt
        _ = assert(stale.isLeft)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        nextPage <- db.transaction(c => PageTable.findById(c, page.id)).map(_.get)
        _ <- workflow.generate(config, nextPage, "内容", None, None)
        retryCalls <- count.get
        _ = assertEquals(retryCalls, 4)
      yield ()
    }
  }
  test(
    "optional planning, review, measurement and refinement failures retain a validated candidate"
  ) {
    List("brief", "review", "refine", "content-loss", "measure").traverse_ { scenario =>
      isolated { db =>
        for
          count <- Ref.of[IO, Int](0)
          nav <- db.transaction(NavigateMessage("fallback.example/" + scenario, None).plan)
          _ <- db.transaction(ClaimGenerationJobMessage().plan)
          page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
          responses = List(
            if scenario == "brief" then Left(new Exception("planning unavailable"))
            else Right(brief.asJson.noSpaces),
            Right(fixture.asJson.noSpaces),
            if scenario == "review" then Right("invalid json") else Right(review.asJson.noSpaces),
            if scenario == "refine" then Right("{}")
            else
              Right(
                (if scenario == "content-loss" then fixture.copy(actions = Nil)
                 else fixture).asJson.noSpaces
              )
          )
          result <- new DesignWorkflowGeneration(
            db,
            provider(responses, count),
            meter(if scenario == "measure" then LayoutReport(Nil, Some("unavailable")) else report)
          ).generate(config, page, "需求", None, None)
          _ = assertEquals(result.title, fixture.title)
          _ = assertEquals(result.actions, fixture.actions)
          n <- count.get
          _ = assertEquals(n, if scenario == "review" then 3 else 4)
          saved <- db.transaction(c => GenerationJobTable.designWorkflow(c, nav.jobId)).map(_.get)
          _ = assert(!saved.asJson.noSpaces.contains("secret"))
          _ = assert(saved.candidate.nonEmpty)
        yield ()
      }
    }
  }
  test("auth stops immediately and invalid generation is capped at four after one brief") {
    List(true, false).traverse_ { auth =>
      isolated { db =>
        for
          count <- Ref.of[IO, Int](0)
          nav <- db.transaction(NavigateMessage("budget.example", None).plan)
          _ <- db.transaction(ClaimGenerationJobMessage().plan)
          page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
          responses =
            if auth then List(Left(AppError("provider_auth", "denied", 502)))
            else Right(brief.asJson.noSpaces) :: List.fill(4)(Right("{}"))
          result <- new DesignWorkflowGeneration(db, provider(responses, count), meter())
            .generate(config, page, "需求", None, None)
            .attempt
          _ = assert(result.isLeft)
          n <- count.get
          _ = assertEquals(n, if auth then 1 else 5)
        yield ()
      }
    }
  }
  test("a timed out optional stage falls back without repeating its paid request") {
    isolated { db =>
      for
        count <- Ref.of[IO, Int](0)
        nav <- db.transaction(NavigateMessage("timeout.example", None).plan)
        _ <- db.transaction(ClaimGenerationJobMessage().plan)
        page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
        client = new TextGenerationClient:
          def complete(
              c: ProviderConnection,
              system: String,
              prompt: String,
              test: Boolean
          ): IO[String] =
            count.getAndUpdate(_ + 1).flatMap {
              case 0 => IO.never
              case 1 => IO.pure(fixture.asJson.noSpaces)
              case _ => IO.pure(DesignReview(Nil).asJson.noSpaces)
            }
        result <- new DesignWorkflowGeneration(db, client, meter(), 20.millis).generate(
          config,
          page,
          "内容",
          None,
          None
        )
        calls <- count.get
        _ = assertEquals(calls, 3)
        _ = assertEquals(result.title, fixture.title)
        saved <- db.transaction(c => GenerationJobTable.designWorkflow(c, nav.jobId)).map(_.get)
        _ = assert(
          saved.events.exists(e =>
            e.stage == DesignStage.Brief && e.status == DesignStageStatus.Failed
          )
        )
      yield ()
    }
  }
  test("regional updates bypass design while full site search participates") {
    List("more", "search").traverse_ { action =>
      isolated { db =>
        val forum = decode[WebDocument](
          Files.readString(Paths.get("../contracts/web-documents/forum.json"))
        ).toOption.get
        val fragment = forum.copy(
          html = "<article id=\"next\">新的回复内容。</article>",
          css = "",
          actions = Nil,
          entities = Nil,
          bindings = Nil
        )
        for
          nav <- db.transaction(NavigateMessage("actions.example", None).plan)
          _ <- db.transaction(ClaimGenerationJobMessage().plan)
          _ <- db.transaction(CompleteWebDocumentMessage(nav.jobId, forum, "mock").plan)
          next <- db.transaction(
            SubmitPageActionMessage(
              nav.pageId,
              action,
              nav.jobId.value,
              "design-action-" + action,
              Map("q" -> "内容")
            ).plan
          )
          job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
          count <- Ref.of[IO, Int](0)
          responses =
            if action == "more" then List(fragment.asJson.noSpaces)
            else
              List(brief.asJson.noSpaces, forum.asJson.noSpaces, DesignReview(Nil).asJson.noSpaces)
          _ <- new GenerationWorker(
            db,
            provider(responses.map(Right(_)), count),
            true,
            webDocuments = true,
            designWorkflow = true,
            layoutMeasurer = meter()
          ).execute(job)
          n <- count.get
          _ = assertEquals(n, if action == "more" then 1 else 3)
          saved <- db.transaction(c => GenerationJobTable.designWorkflow(c, next.jobId))
          _ = assertEquals(saved.nonEmpty, action == "search")
          result <- db.transaction(c => PageTable.findById(c, next.pageId)).map(_.get)
          _ = assertEquals(result.status, PageStatus.Ready)
        yield ()
      }
    }
  }
