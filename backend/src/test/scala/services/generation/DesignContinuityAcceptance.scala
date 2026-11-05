package services.generation
import cats.effect.{IO, IOApp}
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
    val output = Paths.get("../.cache/design-acceptance/discussion-detail.json")
    require(!Files.exists(output), "Existing continuity result retained")
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
      for
        config <- live.transaction(c =>
          SettingsTable.get(c).flatMap(s => GetProviderConnectionMessage(s.revision).plan(c))
        )
        record <- IO.blocking(
          io.circe.parser
            .parse(Files.readString(Paths.get("../.cache/design-acceptance/discussion-new.json")))
            .toOption
            .get
        )
        parent <- db
          .transaction(c =>
            PageTable.findById(c, record.hcursor.get[PageId]("pageId").toOption.get)
          )
          .map(_.get)
        doc = parent.document.get
        action = doc.actions
          .find(a =>
            a.kind == WebActionKind.Navigate && a.target.exists(t =>
              doc.entities.exists(e =>
                e.id == java.net.URI
                  .create(parent.address)
                  .resolve(t)
                  .toString && e.kind == EntityKind.Thread
              )
            )
          )
          .get
        nav <- db.transaction(
          NavigateMessage(
            action.target.get,
            Some(parent.id),
            Some(action.id),
            Some(parent.mode)
          ).plan
        )
        job <- db.transaction(ClaimGenerationJobMessage().plan).map(_.get)
        _ <- IO.raiseWhen(job.id != nav.jobId)(new IllegalStateException("Unexpected queued task"))
        page <- db.transaction(c => PageTable.findById(c, nav.pageId)).map(_.get)
        start <- IO.monotonic
        result <- new DesignWorkflowGeneration(
          db,
          new DeepSeekCompatibleClient(http),
          new NodeLayoutMeasurer
        ).generate(config, page, WebDocumentPrompt.request(page), None, None).attempt
        _ <- result.fold(
          e => db.transaction(FailGenerationJobMessage(job.id, e.getMessage).plan),
          d => db.transaction(CompleteWebDocumentMessage(job.id, d, "live").plan)
        )
        end <- IO.monotonic
        workflow <- db.transaction(c => GenerationJobTable.designWorkflow(c, job.id))
        attempts <- db.transaction(c => GenerationJobTable.diagnostics(c, job.id))
        facts = result.toOption.exists(d =>
          page.navigationContext.toList
            .flatMap(_.entities)
            .filter(_.id == page.address)
            .forall(d.entities.contains)
        )
        brand = result.toOption.exists(_.siteStyle.brand == doc.siteStyle.brand)
        _ <- IO.blocking(
          Files.writeString(
            output,
            Json
              .obj(
                "input" -> page.prompt.asJson,
                "mode" -> page.mode.asJson,
                "pageId" -> page.id.asJson,
                "jobId" -> job.id.asJson,
                "seconds" -> (end - start).toSeconds.asJson,
                "document" -> result.toOption.asJson,
                "error" -> result.left.toOption.map(_.getMessage).asJson,
                "workflow" -> workflow.asJson,
                "attempts" -> attempts.asJson,
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
