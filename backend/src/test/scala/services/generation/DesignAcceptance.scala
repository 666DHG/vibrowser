package services.generation
import cats.effect.{IO, IOApp}
import cats.syntax.all.*
import io.circe.Json
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import scala.concurrent.duration.*
import org.http4s.ember.client.EmberClientBuilder
import services.system.{DatabaseSession, SchemaInitializer, SqlExecutor}
import services.browser.api.{NavigateMessage, RetryPageMessage}
import services.browser.objects.*
import services.browser.tables.PageTable.PageTable
import services.browser.tables.ResearchSnapshotTable.ResearchSnapshotTable
import services.settings.api.{GetProviderConnectionMessage, GetResearchConnectionMessage}
import services.settings.tables.SettingsTable.SettingsTable
import services.generation.api.*
import services.generation.objects.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.generation.utils.*

/** Explicit opt-in paid comparison; uses a separate schema and never writes credentials. */
object DesignAcceptance extends IOApp.Simple:
  private val samples = List(
    ("academic", "清华教师袁洋的个人学术主页.com", BrowsingMode.Research),
    ("discussion", "深夜电台听众交流社区.com", BrowsingMode.Imagination),
    ("comparison", "便携手冲咖啡器具对比选购.com", BrowsingMode.Imagination),
    ("reading", "PostgreSQL事务隔离与并发控制学习笔记.com", BrowsingMode.Research),
    ("news", "2024年嫦娥六号月背采样新闻专题.com", BrowsingMode.Research),
    ("writing", "一个沿海小城居民的散步随笔.com", BrowsingMode.Imagination)
  )
  private val output = Paths.get("../.cache/design-acceptance")
  private def write(name: String, json: Json): IO[Unit] = IO.blocking {
    Files.createDirectories(output)
    Files.writeString(output.resolve(name + ".json"), json.spaces2)
    ()
  }
  def run: IO[Unit] =
    require(
      sys.env.get("VIBROWSER_PAID_DESIGN_ACCEPTANCE").contains("true"),
      "Explicit paid acceptance opt-in required"
    )
    val resources = for
      live <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=vibrowser_live",
        "vibrowser",
        ""
      )
      db <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=design_acceptance",
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
      val client = new DeepSeekCompatibleClient(http)
      val search = new DeepSeekResearchClient(http)
      for
        config <- live.transaction(c =>
          SettingsTable.get(c).flatMap(s => GetProviderConnectionMessage(s.revision).plan(c))
        )
        searchConfig <- live.transaction(GetResearchConnectionMessage().plan)
        _ <- db.transaction(c =>
          SqlExecutor.update(
            c,
            "CREATE SCHEMA IF NOT EXISTS design_acceptance"
          ) *> SchemaInitializer.initialize(c)
        )
        _ <- samples.traverse_ { (name, input, mode) =>
          List(false, true)
            .foldLeftM(Option.empty[ResearchSnapshot]) { (priorResearch, enabled) =>
              val label = name + (if enabled then "-new" else "-old")
              val existing = Option.when(Files.exists(output.resolve(label + ".json")))(
                io.circe.parser
                  .parse(Files.readString(output.resolve(label + ".json")))
                  .toOption
                  .get
              )
              val retry = sys.env.get("VIBROWSER_DESIGN_ACCEPTANCE_RETRY").contains(name) &&
                existing.exists(_.hcursor.get[String]("error").isRight) &&
                !Files.exists(output.resolve(label + "-first-failure.json"))
              if existing.nonEmpty && !retry then
                IO.blocking(
                  io.circe.parser
                    .parse(Files.readString(output.resolve(label + ".json")))
                    .toOption
                    .get
                    .hcursor
                    .get[Option[ResearchSnapshot]]("research")
                    .toOption
                    .flatten
                )
              else
                for
                  _ <- IO.println("START " + label)
                  start <- IO.monotonic
                  _ <- if retry then write(label + "-first-failure", existing.get) else IO.unit
                  nav <-
                    if retry then
                      val cursor = existing.get.hcursor
                      db.transaction(
                        RetryPageMessage(
                          cursor.get[PageId]("pageId").toOption.get,
                          cursor.get[JobId]("jobId").toOption.get
                        ).plan
                      )
                    else db.transaction(NavigateMessage(input, None, mode = Some(mode)).plan)
                  job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
                  _ <- IO.raiseWhen(job.id != nav.jobId)(
                    new IllegalStateException("Unexpected queued acceptance job")
                  )
                  page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
                  researchResult <- (if mode == BrowsingMode.Research then
                                       priorResearch match
                                         case Some(s) =>
                                           db.transaction(c =>
                                             ResearchSnapshotTable.save(c, s.copy(pageId = page.id))
                                           ).as(Some(s.copy(pageId = page.id)))
                                         case None =>
                                           new ResearchPipeline(db, client, search)
                                             .prepare(page, config, searchConfig)
                                             .map(Some(_))
                                     else IO.pure(Option.empty[ResearchSnapshot])).attempt
                  research = researchResult.toOption.flatten
                  request = WebDocumentPrompt
                    .request(page) + research.map(ResearchContent.prompt).getOrElse("")
                  result <- researchResult match
                    case Left(e) => IO.pure(Left(e))
                    case Right(s) if s.exists(!_.complete) =>
                      IO.pure(Left(new IllegalStateException("Research needs subject selection")))
                    case _ =>
                      (if enabled then
                         new DesignWorkflowGeneration(db, client, new NodeLayoutMeasurer).generate(
                           config,
                           page,
                           request,
                           None,
                           research
                         )
                       else
                         new WebDocumentGeneration(db, client).generate(
                           config,
                           page,
                           request,
                           research = research,
                           system = WebDocumentPrompt.legacySystem
                         )
                      ).attempt
                  _ <- result.fold(
                    e => db.transaction(FailGenerationJobMessage(job.id, e.getMessage).plan),
                    d => db.transaction(CompleteWebDocumentMessage(job.id, d, "live").plan)
                  )
                  end <- IO.monotonic
                  workflow <- db.transaction(c => GenerationJobTable.designWorkflow(c, job.id))
                  attempts <- db.transaction(c => GenerationJobTable.diagnostics(c, job.id))
                  _ <- write(
                    label,
                    Json.obj(
                      "input" -> input.asJson,
                      "mode" -> mode.asJson,
                      "pageId" -> page.id.asJson,
                      "jobId" -> job.id.asJson,
                      "seconds" -> (end - start).toSeconds.asJson,
                      "document" -> result.toOption.asJson,
                      "error" -> result.left.toOption.map(_.getMessage).asJson,
                      "research" -> research.asJson,
                      "workflow" -> workflow.asJson,
                      "attempts" -> attempts.asJson
                    )
                  )
                  _ <- IO.println(
                    "END " + label + " " + result.fold(
                      e => "FAILED: " + e.getMessage,
                      _ => "ready"
                    ) + " " + (end - start).toSeconds + "s"
                  )
                yield research
            }
            .void
        }
      yield ()
    }
