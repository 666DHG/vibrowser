package services.generation.utils
import cats.effect.IO
import cats.syntax.all.*
import io.circe.Decoder
import io.circe.parser.decode
import io.circe.syntax.*
import scala.concurrent.duration.*
import services.system.DatabaseSession
import services.system.objects.AppError
import services.browser.objects.*
import services.generation.objects.*
import services.generation.api.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.settings.objects.ProviderConnection
private[generation] final class DesignWorkflowGeneration(
    database: DatabaseSession,
    client: TextGenerationClient,
    meter: LayoutMeasurer,
    stageTimeout: FiniteDuration = 60.seconds
):
  private def done(w: DesignWorkflow, stage: DesignStage): Boolean =
    w.events.exists(_.stage == stage)
  private def event(
      stage: DesignStage,
      status: DesignStageStatus,
      message: Option[String] = None,
      output: Option[String] = None
  ): DesignEvent =
    DesignEvent(stage, status, java.time.Instant.now.toString, message, output)
  private def save(page: PageRecord, w: DesignWorkflow): IO[DesignWorkflow] =
    database.transaction(SaveDesignWorkflowMessage(page.currentJobId, w).plan).as(w)
  private def phase(page: PageRecord, value: GenerationPhase): IO[Unit] =
    database.transaction(UpdateGenerationPhaseMessage(page.currentJobId, value).plan)
  private def call[A: Decoder](
      config: ProviderConnection,
      page: PageRecord,
      w: DesignWorkflow,
      stage: DesignStage,
      system: String,
      prompt: String
  )(accept: (DesignWorkflow, A) => DesignWorkflow): IO[DesignWorkflow] =
    if done(w, stage) then IO.pure(w)
    else
      for
        started <- save(page, w.copy(events = w.events :+ event(stage, DesignStageStatus.Started)))
        response <- client.complete(config, system, prompt, false).timeout(stageTimeout).attempt
        decoded = response.flatMap(text =>
          decode[A](text).left.map(identity[Throwable]).map(value => (text, value))
        )
        result = decoded match
          case Right((text, value)) =>
            scala.util.Try(accept(started, value)).toEither match
              case Right(next) =>
                next.copy(events =
                  next.events :+ event(stage, DesignStageStatus.Completed, output = Some(text))
                )
              case Left(e) =>
                started.copy(events =
                  started.events :+ event(
                    stage,
                    DesignStageStatus.Failed,
                    Some(e.getMessage),
                    Some(text)
                  )
                )
          case Left(e) =>
            started.copy(events =
              started.events :+ event(
                stage,
                DesignStageStatus.Failed,
                Some(e.getMessage),
                response.toOption
              )
            )
        saved <- save(page, result)
        _ <- response match
          case Left(e: AppError)
              if stage == DesignStage.Brief && Set(
                "provider_auth",
                "provider_quota",
                "provider_rate_limit"
              )(e.code) =>
            IO.raiseError(e)
          case _ => IO.unit
      yield saved
  private def measure(
      page: PageRecord,
      w: DesignWorkflow,
      doc: WebDocument,
      improved: Boolean
  ): IO[DesignWorkflow] =
    val stage = if improved then DesignStage.MeasureImproved else DesignStage.MeasureOriginal
    if done(w, stage) then IO.pure(w)
    else
      for
        _ <- phase(page, GenerationPhase.Measuring)
        started <- save(page, w.copy(events = w.events :+ event(stage, DesignStageStatus.Started)))
        report <- meter
          .measure(doc)
          .timeout(30.seconds)
          .handleError(e => LayoutReport(Nil, Some(e.getClass.getSimpleName)))
        updated =
          if improved then started.copy(improvedLayout = Some(report))
          else started.copy(originalLayout = Some(report))
        result <- save(
          page,
          updated.copy(events =
            updated.events :+ event(
              stage,
              if report.error.nonEmpty then DesignStageStatus.Failed
              else DesignStageStatus.Completed,
              report.error
            )
          )
        )
      yield result
  def generate(
      config: ProviderConnection,
      page: PageRecord,
      prompt: String,
      snapshot: Option[PageActionSnapshot],
      research: Option[ResearchSnapshot]
  ): IO[WebDocument] =
    val generator = new WebDocumentGeneration(database, client)
    for
      previous <- database.transaction(c => GenerationJobTable.designWorkflow(c, page.currentJobId))
      initial = previous.getOrElse(DesignWorkflow(DesignGuidance.version))
      _ <-
        if done(initial, DesignStage.Brief) then IO.unit else phase(page, GenerationPhase.Designing)
      planned <- call[DesignBrief](
        config,
        page,
        initial,
        DesignStage.Brief,
        DesignPrompts.briefSystem,
        prompt
      ) { (w, b) =>
        require(
          b.asJson.noSpaces.length <= 16000 && b.purpose.trim.nonEmpty && b.visitorTask.trim.nonEmpty && b.informationStructure.trim.nonEmpty && b.contentPriorities.size <= 12 && b.interactions.size <= 12,
          "设计说明字段无效或超出预算"
        )
        w.copy(brief = Some(b))
      }
      fullPrompt =
        prompt + "\n设计指导：\n" + DesignGuidance.design + "\n交互能力：\n" + WebDocumentPrompt.actionContract + "\n设计说明：" + planned.brief.asJson.noSpaces
      candidate <- planned.candidate match
        case Some(doc) => generator.validate(page, doc.asJson.noSpaces, snapshot, research)
        case None      => generator.generate(config, page, fullPrompt, snapshot, research)
      saved <-
        if planned.candidate.nonEmpty then IO.pure(planned)
        else save(page, planned.copy(candidate = Some(candidate)))
      measured <- measure(page, saved, candidate, false)
      _ <-
        if done(measured, DesignStage.Review) then IO.unit
        else phase(page, GenerationPhase.Reviewing)
      reviewed <- call[DesignReview](
        config,
        page,
        measured,
        DesignStage.Review,
        DesignPrompts.reviewSystem,
        DesignPrompts.reviewRequest(prompt, measured, candidate)
      ) { (w, r) =>
        require(
          r.issues.size <= 5 && r.asJson.noSpaces.length <= 16000 && r.issues.forall(i =>
            List(i.target, i.observation, i.impact, i.change).forall(_.trim.nonEmpty)
          ),
          "评审问题无效或过多"
        )
        w.copy(review = Some(r))
      }
      improved <-
        if reviewed.review.exists(_.issues.nonEmpty) && !done(reviewed, DesignStage.Improve) then
          for
            _ <- phase(page, GenerationPhase.Refining)
            started <- save(
              page,
              reviewed.copy(events =
                reviewed.events :+ event(DesignStage.Improve, DesignStageStatus.Started)
              )
            )
            response <- client
              .complete(
                config,
                WebDocumentPrompt.system,
                DesignPrompts.improveRequest(prompt, reviewed, candidate),
                false
              )
              .timeout(180.seconds)
              .attempt
            validated <- response
              .traverse(text => generator.validate(page, text, snapshot, research))
              .attempt
            accepted = validated
              .flatMap(identity)
              .flatMap(doc =>
                val issues = DesignPreservation.issues(
                  candidate,
                  doc,
                  reviewed.review.toList.flatMap(_.issues.map(_.target)).toSet
                )
                Either.cond(
                  issues.isEmpty,
                  doc,
                  AppError("design_regression", issues.mkString("; "), 502)
                )
              )
            next = accepted match
              case Right(doc) =>
                started.copy(
                  improved = Some(doc),
                  events = started.events :+ event(
                    DesignStage.Improve,
                    DesignStageStatus.Completed,
                    output = response.toOption
                  )
                )
              case Left(e) =>
                started.copy(events =
                  started.events :+ event(
                    DesignStage.Improve,
                    DesignStageStatus.Failed,
                    Some(e.getMessage),
                    response.toOption
                  )
                )
            result <- save(page, next)
          yield result
        else IO.pure(reviewed)
      checked <- improved.improved.fold(IO.pure(improved))(doc =>
        measure(page, improved, doc, true)
      )
      adopt = checked.improved.nonEmpty && checked.originalLayout.exists(r =>
        r.error.isEmpty && r.viewports.map(_.width).toSet == Set(390, 1440)
      ) && checked.improvedLayout.exists(r =>
        r.error.isEmpty && r.viewports.map(_.width).toSet == Set(390, 1440)
      ) &&
        !DesignPreservation.layoutWorsened(checked.originalLayout.get, checked.improvedLayout.get)
      selected = checked.copy(selection =
        if adopt then DesignSelection.Improved else DesignSelection.Original
      )
      _ <-
        if done(selected, DesignStage.Selection) then IO.unit
        else
          save(
            page,
            selected.copy(events =
              selected.events :+
                event(
                  DesignStage.Selection,
                  DesignStageStatus.Completed,
                  Some(if adopt then "采用改进页面" else "采用已校验原页面")
                )
            )
          ).void
    yield if adopt then checked.improved.get else candidate
