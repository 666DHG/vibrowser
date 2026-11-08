package services.generation
import cats.effect.{IO, IOApp, Ref, Resource}
import cats.syntax.all.*
import io.circe.Json
import io.circe.syntax.*
import io.circe.parser.parse
import java.nio.file.{Files, Paths}
import scala.concurrent.duration.*
import org.http4s.client.Client
import org.http4s.circe.CirceEntityCodec.*
import org.http4s.ember.client.EmberClientBuilder
import services.system.{DatabaseSession, SchemaInitializer, SqlExecutor}
import services.browser.api.NavigateMessage
import services.browser.objects.*
import services.browser.tables.PageTable.PageTable
import services.browser.tables.ResearchSnapshotTable.ResearchSnapshotTable
import services.settings.api.{GetProviderConnectionMessage, GetResearchConnectionMessage}
import services.settings.tables.SettingsTable.SettingsTable
import services.settings.objects.ProviderConnection
import services.generation.api.*
import services.generation.objects.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.generation.utils.*

/** Fixed paid experiment: no sample selection, automatic rerolls, or LIVE mutations. */
object EffortAcceptance extends IOApp.Simple:
  private val guidanceRetest = sys.env.get("VIBROWSER_EFFORT_GUIDANCE_RETEST").contains("true")
  private val guidanceRevision = sys.env.getOrElse("VIBROWSER_EFFORT_GUIDANCE_VERSION", "3")
  private val samplingRetest = sys.env.get("VIBROWSER_DESIGN_SAMPLING_RETEST").contains("true")
  private val deepRetest = sys.env.get("VIBROWSER_DESIGN_DEEP_RETEST").contains("true")
  private val effortSuffix = if deepRetest then "_deep" else ""
  private val experimentGuidance =
    if guidanceRetest && guidanceRevision == "9" then DesignGuidance.draftExperiment
    else DesignGuidance.current
  private val schema =
    if samplingRetest then "effort_sampling_v1"
    else if guidanceRetest then "effort_guidance_v" + guidanceRevision + effortSuffix
    else "effort_acceptance"
  private val output = Paths.get(
    if samplingRetest then "../.cache/effort-sampling-v1"
    else if guidanceRetest then
      "../.cache/effort-guidance-v" + guidanceRevision + effortSuffix.replace('_', '-')
    else "../.cache/effort-acceptance"
  )
  private val samples = List(
    ("academic", "清华教师袁洋的个人学术主页.com", BrowsingMode.Research),
    ("copy", "kfc疯狂星期四文案合集站.com", BrowsingMode.Imagination),
    ("calendar", "今天是什么日子.com", BrowsingMode.Imagination),
    ("comparison", "便携手冲咖啡器具对比选购.com", BrowsingMode.Imagination),
    ("docs", "PostgreSQL事务隔离与并发控制学习笔记.com", BrowsingMode.Research),
    ("essay", "一个沿海小城居民的散步随笔.com", BrowsingMode.Imagination)
  )
  private def write(name: String, value: Json): IO[Unit] = IO.blocking {
    Files.createDirectories(output)
    Files.writeString(output.resolve(name + ".json"), value.spaces2)
    ()
  }
  private def read(name: String): IO[Option[Json]] = IO.blocking {
    Option.when(Files.exists(output.resolve(name + ".json")))(
      parse(Files.readString(output.resolve(name + ".json"))).fold(throw _, identity)
    )
  }
  private[generation] def metered(
      http: Client[IO],
      records: Ref[IO, Vector[Json]],
      temperature: Option[Double] = None
  ): Client[IO] =
    Client { request =>
      for
        start <- Resource.eval(IO.monotonic)
        original <- Resource.eval(request.as[Json])
        payload = DesignSamplingExperiment.payload(
          original,
          request.uri.host.exists(_.value == "api.deepseek.com"),
          temperature
        )
        system = payload.hcursor
          .downField("messages")
          .downArray
          .get[String]("content")
          .toOption
          .getOrElse("")
        record = Json.obj(
          "model" -> payload.hcursor.get[String]("model").toOption.asJson,
          "temperature" -> payload.hcursor.get[Double]("temperature").toOption.asJson,
          "maxTokens" -> payload.hcursor.get[Int]("max_tokens").toOption.asJson,
          "thinking" -> payload.hcursor.downField("thinking").focus.asJson,
          "reasoningEffort" -> payload.hcursor.get[String]("reasoning_effort").toOption.asJson,
          "stage" -> (if system.startsWith("ResearchPlan:") then "researchPlanning"
                      else if system == DesignPrompts.draftSystem then "draft"
                      else if system.contains("这是简短设计说明") then "brief"
                      else if system.contains("最多5项") then "review"
                      else "document") .asJson
        )
        index <- Resource.eval(records.modify(rows => (rows :+ record, rows.size)))
        response <- http.run(request.withEntity(payload))
        result <- Resource.eval(response.as[Json])
        end <- Resource.eval(IO.monotonic)
        _ <- Resource.eval(
          records.update(rows =>
            rows.updated(
              index,
              record.deepMerge(
                Json.obj(
                  "usage" -> result.hcursor.downField("usage").focus.asJson,
                  "finishReason" -> result.hcursor
                    .downField("choices")
                    .downArray
                    .get[String]("finish_reason")
                    .toOption
                    .asJson,
                  "status" -> response.status.code.asJson,
                  "milliseconds" -> (end - start).toMillis.asJson
                )
              )
            )
          )
        )
      yield response.withEntity(result)
    }
  def run: IO[Unit] =
    require(
      !deepRetest || (guidanceRetest && guidanceRevision == "8" && !samplingRetest),
      "Deep comparison requires isolated v8 guidance without sampling changes"
    )
    require(
      !samplingRetest || (guidanceRetest && guidanceRevision == "7"),
      "Sampling test requires the unchanged v7 guidance"
    )
    require(
      Set("3", "4", "5", "6", "7", "8", "9")(guidanceRevision),
      "Unsupported fixed experiment revision"
    )
    require(
      !guidanceRetest || experimentGuidance.version.startsWith(guidanceRevision + "-"),
      "Guidance build must match the isolated experiment directory"
    )
    require(
      sys.env.get("VIBROWSER_PAID_EFFORT_ACCEPTANCE").contains("true"),
      "Paid experiment opt-in required"
    )
    val resources = for
      live <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=vibrowser_live",
        "vibrowser",
        ""
      )
      db <- DatabaseSession.resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=" + schema,
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
        base <- live.transaction(c =>
          SettingsTable.get(c).flatMap(s => GetProviderConnectionMessage(s.revision).plan(c))
        )
        searchConfig <- live.transaction(GetResearchConnectionMessage().plan)
        _ <- IO.raiseUnless(java.net.URI.create(base.baseUrl).getHost == "api.deepseek.com")(
          new Exception("Official provider required")
        )
        _ <- db.transaction(c =>
          SqlExecutor.update(
            c,
            "CREATE SCHEMA IF NOT EXISTS " + schema
          ) *> SchemaInitializer.initialize(c)
        )
        old <-
          if guidanceRetest then IO.pure(experimentGuidance)
          else
            IO.blocking(
              DesignGuidanceText(
                "baseline-6ad0a7c",
                Files.readString(output.resolve("old-design.md")),
                Files.readString(output.resolve("old-review.md"))
              )
            )
        _ <- samples.traverse_ { (name, input, mode) =>
          for
            reference <-
              if guidanceRetest then
                IO.blocking(
                  Some(
                    parse(
                      Files.readString(
                        Paths.get("../.cache/effort-acceptance/" + name + "-new-standard.json")
                      )
                    ).fold(throw _, identity)
                  )
                )
              else IO.pure(None)
            _ <- IO.raiseUnless(
              !guidanceRetest || reference.exists(r =>
                r.hcursor.get[String]("request").exists(_.nonEmpty) &&
                  (mode == BrowsingMode.Imagination || r.hcursor
                    .get[Option[ResearchSnapshot]]("research")
                    .toOption
                    .flatten
                    .exists(_.complete))
              )
            )(
              new Exception(
                "Complete original request and research required; retest must not purchase new retrieval"
              )
            )
            sharedResearch <- Ref.of[IO, Option[ResearchSnapshot]](
              reference.flatMap(
                _.hcursor.get[Option[ResearchSnapshot]]("research").toOption.flatten
              )
            )
            sharedRequest <- Ref.of[IO, Option[String]](
              reference.flatMap(_.hcursor.get[String]("request").toOption)
            )
            variants =
              if guidanceRetest then
                if deepRetest then List(("new-deep", experimentGuidance, GenerationEffort.Deep))
                else List(("new-standard", experimentGuidance, GenerationEffort.Standard))
              else
                List(
                  ("old-standard", old, GenerationEffort.Standard),
                  ("new-standard", DesignGuidance.current, GenerationEffort.Standard),
                  ("new-deep", DesignGuidance.current, GenerationEffort.Deep)
                )
            _ <- variants.traverse_ { (variant, guidance, effort) =>
              val label = name + "-" + variant
              read(label).flatMap {
                case Some(existing) =>
                  sharedResearch.set(
                    existing.hcursor.get[Option[ResearchSnapshot]]("research").toOption.flatten
                  ) *>
                    sharedRequest.set(existing.hcursor.get[String]("request").toOption) *> IO
                      .println("SKIP " + label)
                case None =>
                  for
                    marker <- read(label + "-started")
                    _ <- IO.raiseWhen(marker.nonEmpty)(
                      new Exception("Unfinished experiment requires explicit review: " + label)
                    )
                    _ <- IO.println("START " + label)
                    start <- IO.monotonic
                    nav <- db.transaction(
                      NavigateMessage(input, None, mode = Some(mode), effort = Some(effort)).plan
                    )
                    job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
                    _ <- IO.raiseUnless(job.id == nav.jobId)(new Exception("Unexpected queued job"))
                    _ <- write(
                      label + "-started",
                      Json.obj(
                        "pageId" -> nav.pageId.asJson,
                        "jobId" -> nav.jobId.asJson,
                        "at" -> java.time.Instant.now.toString.asJson
                      )
                    )
                    page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
                    records <- Ref.of[IO, Vector[Json]](Vector.empty)
                    client = new DeepSeekCompatibleClient(
                      metered(http, records, Option.when(samplingRetest)(1.3))
                    )
                    config = new ProviderConnection(
                      base.baseUrl,
                      base.model,
                      base.key,
                      base.revision,
                      effort
                    )
                    prior <- sharedResearch.get
                    researched <- (if mode == BrowsingMode.Imagination then
                                     IO.pure(Option.empty[ResearchSnapshot])
                                   else
                                     prior match
                                       case Some(snapshot) =>
                                         db.transaction(c =>
                                           ResearchSnapshotTable
                                             .save(c, snapshot.copy(pageId = page.id))
                                         ).as(Some(snapshot.copy(pageId = page.id)))
                                       case None =>
                                         new ResearchPipeline(
                                           db,
                                           client,
                                           new DeepSeekResearchClient(http)
                                         ).prepare(page, config, searchConfig).map(Some(_))
                    ).attempt
                    research = researched.toOption.flatten
                    _ <- sharedResearch.set(research)
                    previousRequest <- sharedRequest.get
                    request = previousRequest.getOrElse(
                      WebDocumentPrompt
                        .request(page) + research.map(ResearchContent.prompt).getOrElse("")
                    )
                    _ <- sharedRequest.set(Some(request))
                    result <- researched match
                      case Left(error) => IO.pure(Left(error))
                      case Right(value) if value.exists(!_.complete) =>
                        IO.pure(Left(new Exception("Subject selection required")))
                      case _ =>
                        new DesignWorkflowGeneration(
                          db,
                          client,
                          new NodeLayoutMeasurer,
                          guidance = guidance
                        )
                          .generate(config, page, request, None, research)
                          .attempt
                    _ <- result.fold(
                      e => db.transaction(FailGenerationJobMessage(job.id, e.getMessage).plan),
                      document =>
                        db.transaction(CompleteWebDocumentMessage(job.id, document, "live").plan)
                    )
                    end <- IO.monotonic
                    workflow <- db.transaction(c => GenerationJobTable.designWorkflow(c, job.id))
                    attempts <- db.transaction(c => GenerationJobTable.diagnostics(c, job.id))
                    usage <- records.get
                    _ <- write(
                      label,
                      Json.obj(
                        "input" -> input.asJson,
                        "mode" -> mode.asJson,
                        "effort" -> effort.asJson,
                        "guidance" -> guidance.version.asJson,
                        "pageId" -> page.id.asJson,
                        "jobId" -> job.id.asJson,
                        "seconds" -> (end - start).toSeconds.asJson,
                        "request" -> request.asJson,
                        "research" -> research.asJson,
                        "document" -> result.toOption.asJson,
                        "error" -> result.left.toOption.map(_.getMessage).asJson,
                        "workflow" -> workflow.asJson,
                        "attempts" -> attempts.asJson,
                        "modelCalls" -> usage.asJson
                      )
                    )
                    _ <- IO.println(
                      "END " + label + " " + result.fold(
                        e => "FAILED: " + e.getMessage,
                        _ => "ready"
                      ) + " " + (end - start).toSeconds + "s"
                    )
                  yield ()
              }
            }
          yield ()
        }
      yield ()
    }
