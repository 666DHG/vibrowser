package services.generation
import cats.effect.{IO, IOApp, Ref}
import cats.syntax.all.*
import io.circe.Json
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import scala.concurrent.duration.*
import org.http4s.ember.client.EmberClientBuilder
import services.system.DatabaseSession
import services.browser.api.NavigateMessage
import services.browser.objects.*
import services.browser.tables.PageTable.PageTable
import services.settings.api.GetProviderConnectionMessage
import services.settings.tables.SettingsTable.SettingsTable
import services.generation.api.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.generation.utils.*
object DesignContinuityAcceptance extends IOApp.Simple:
  def run: IO[Unit] =
    require(
      sys.env.get("VIBROWSER_PAID_DESIGN_ACCEPTANCE").contains("true"),
      "Explicit opt-in required"
    )
    val schema = sys.env.getOrElse("VIBROWSER_CONTINUITY_SCHEMA", "design_acceptance")
    val source = sys.env.getOrElse("VIBROWSER_CONTINUITY_SOURCE", "discussion-new")
    val label = sys.env.getOrElse("VIBROWSER_CONTINUITY_LABEL", "discussion-detail")
    require(
      Set(
        "design_acceptance",
        "effort_acceptance",
        "effort_guidance_v6",
        "effort_guidance_v8",
        "effort_guidance_v8_deep",
        "effort_guidance_v8_low"
      )(schema),
      "Isolated acceptance schema required"
    )
    require(List(source, label).forall(_.matches("[a-z0-9-]+")), "Invalid sample name")
    val directory = Paths.get("../.cache/" + schema.replace('_', '-'))
    val output = directory.resolve(label + ".json")
    val marker = directory.resolve(label + "-started.json")
    require(!Files.exists(output), "Existing continuity result retained")
    require(!Files.exists(marker), "Unfinished continuity request requires explicit review")
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
        record <- IO.blocking(
          io.circe.parser
            .parse(Files.readString(directory.resolve(source + ".json")))
            .toOption
            .get
        )
        policy = record.hcursor.get[String]("effortPolicy").getOrElse("product")
        lowThinking = policy == "experimental-low"
        _ <- IO.raiseUnless(lowThinking == schema.endsWith("_low"))(
          new IllegalArgumentException("Parent effort policy does not match the isolated schema")
        )
        _ <- IO.raiseUnless(
          record.hcursor
            .downField("workflow")
            .get[String]("guidanceVersion")
            .contains(DesignGuidance.current.version)
        )(
          new IllegalArgumentException("Build guidance differs from the saved parent")
        )
        parent <- db
          .transaction(c =>
            PageTable.findById(c, record.hcursor.get[PageId]("pageId").toOption.get)
          )
          .map(_.get)
        doc = parent.document.get
        _ <- IO.raiseUnless(parent.mode == BrowsingMode.Imagination)(
          new IllegalArgumentException(
            "This replay requires an imagination parent; research needs its retrieval pipeline"
          )
        )
        action = doc.actions
          .find(a =>
            a.kind == WebActionKind.Navigate && sys.env
              .get("VIBROWSER_CONTINUITY_ACTION")
              .fold(
                a.target.exists(t =>
                  doc.entities.exists(e =>
                    e.id == java.net.URI
                      .create(parent.address)
                      .resolve(t)
                      .toString && e.kind == EntityKind.Thread
                  )
                )
              )(_ == a.id)
          )
          .get
        nav <- db.transaction(
          NavigateMessage(
            action.target.get,
            Some(parent.id),
            Some(action.id),
            Some(parent.mode),
            Some(parent.effort)
          ).plan
        )
        job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
        _ <- IO.raiseWhen(job.id != nav.jobId)(new IllegalStateException("Unexpected queued task"))
        _ <- IO.blocking(
          Files.writeString(
            marker,
            Json.obj("pageId" -> nav.pageId.asJson, "jobId" -> job.id.asJson).spaces2
          )
        )
        page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
        config = new services.settings.objects.ProviderConnection(
          base.baseUrl,
          base.model,
          base.key,
          base.revision,
          page.effort
        )
        start <- IO.monotonic
        calls <- Ref.of[IO, Vector[Json]](Vector.empty)
        result <- new DesignWorkflowGeneration(
          db,
          new DeepSeekCompatibleClient(
            EffortAcceptance.metered(http, calls, lowThinking = lowThinking)
          ),
          new NodeLayoutMeasurer
        ).generate(config, page, WebDocumentPrompt.request(page), None, None).attempt
        _ <- result.fold(
          e => db.transaction(FailGenerationJobMessage(job.id, e.getMessage).plan),
          d => db.transaction(CompleteWebDocumentMessage(job.id, d, "live").plan)
        )
        end <- IO.monotonic
        workflow <- db.transaction(c => GenerationJobTable.designWorkflow(c, job.id))
        attempts <- db.transaction(c => GenerationJobTable.diagnostics(c, job.id))
        usage <- calls.get
        inherited = page.navigationContext.toList.flatMap(_.entities).filter(_.id == page.address)
        facts = result.toOption.exists(d =>
          inherited.nonEmpty && inherited.forall(d.entities.contains)
        )
        brand = result.toOption.exists(_.siteStyle.brand == doc.siteStyle.brand)
        _ <- IO.blocking(
          Files.writeString(
            output,
            Json
              .obj(
                "input" -> page.prompt.asJson,
                "mode" -> page.mode.asJson,
                "effort" -> page.effort.asJson,
                "effortPolicy" -> policy.asJson,
                "target" -> page.address.asJson,
                "sourceAction" -> action.asJson,
                "context" -> page.navigationContext.asJson,
                "pageId" -> page.id.asJson,
                "jobId" -> job.id.asJson,
                "seconds" -> (end - start).toSeconds.asJson,
                "document" -> result.toOption.asJson,
                "error" -> result.left.toOption.map(_.getMessage).asJson,
                "workflow" -> workflow.asJson,
                "attempts" -> attempts.asJson,
                "modelCalls" -> usage.asJson,
                "inheritedEntityCount" -> inherited.size.asJson,
                "factsPreserved" -> facts.asJson,
                "brandPreserved" -> brand.asJson,
                "parentPageId" -> parent.id.asJson
              )
              .spaces2
          )
        )
        _ <- IO.println(s"Continuity ready=${result.isRight}, facts=$facts, brand=$brand")
      yield ()
    }
