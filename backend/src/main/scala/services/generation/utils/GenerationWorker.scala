package services.generation.utils
import cats.effect.IO
import cats.syntax.all.*
import scala.concurrent.duration.*
import services.system.DatabaseSession
import services.system.objects.AppError
import services.generation.api.*
import services.generation.objects.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.browser.objects.*
import services.browser.api.ValidateGeneratedContentMessage
import services.browser.tables.PageTable.PageTable
import services.settings.api.GetProviderConnectionMessage
import services.settings.objects.ProviderConnection
private[generation] final class GenerationWorker(
    database: DatabaseSession,
    client: TextGenerationClient,
    mock: Boolean
):
  private[generation] def run: IO[Unit] =
    def tick: IO[Unit] =
      database.transaction(ClaimGenerationJobMessage().plan).flatMap {
        case None => IO.sleep(300.millis)
        case Some(job) =>
          execute(job).handleErrorWith { error =>
            val message = error match
              case e: AppError => e.getMessage
              case _           => "生成暂时失败，请重试"
            database.transaction(FailGenerationJobMessage(job.id, message).plan)
          }
      }
    (tick.handleErrorWith(_ => IO.sleep(1.second)) *> IO.defer(run))
  private[generation] def execute(job: GenerationJob): IO[Unit] =
    for
      config <-
        if mock then
          IO.pure(
            new ProviderConnection("https://mock.invalid", "fixture", "", job.settingsRevision)
          )
        else database.transaction(GetProviderConnectionMessage(job.settingsRevision).plan)
      content <- job.pageId match
        case None =>
          database.transaction(
            UpdateGenerationPhaseMessage(job.id, GenerationPhase.Generating).plan
          ) *> client
            .complete(config, "Return JSON only.", "Return {\"ok\":true}", true)
            .as(Option.empty[PageSpec])
        case Some(id) =>
          for
            page <- database
              .transaction(c => PageTable.findById(c, id))
              .flatMap(IO.fromOption(_)(AppError("not_found", "页面不存在", 404)))
            spec <- generate(config, page, PromptBuilder.request(page), 0)
          yield Some(spec)
      current <- database.transaction(c => GenerationJobTable.findById(c, job.id))
      _ <- database.transaction(
        UpdateGenerationPhaseMessage(
          job.id,
          GenerationPhase.Saving,
          current.flatMap(_.steps.lastOption).fold(1)(_.attempt)
        ).plan
      )
      _ <- database.transaction(
        CompleteGenerationJobMessage(job.id, content, if mock then "mock" else "live").plan
      )
    yield ()
  private def generate(
      config: ProviderConnection,
      page: PageRecord,
      prompt: String,
      attempt: Int
  ): IO[PageSpec] =
    def validate(text: String): IO[PageSpec] =
      for
        _ <- database.transaction(
          UpdateGenerationPhaseMessage(
            page.currentJobId,
            GenerationPhase.Validating,
            attempt + 1
          ).plan
        )
        decoded <- IO.fromEither(GeneratedPageDecoder.decode(text))
        spec <- IO.fromEither(InheritedContent.prepare(decoded, page))
        issues <- database.transaction(ValidateGeneratedContentMessage(spec, page.address).plan)
        _ <- IO.raiseWhen(issues.nonEmpty)(
          AppError(
            "invalid_content",
            issues.take(6).map(i => i.path + ": " + i.message).mkString("; "),
            502
          )
        )
      yield spec
    database.transaction(
      UpdateGenerationPhaseMessage(page.currentJobId, GenerationPhase.Generating, attempt + 1).plan
    ) *> client.complete(config, PromptBuilder.system, prompt, false).attempt.flatMap {
      case Right(text) =>
        validate(text).handleErrorWith {
          case e: AppError if attempt == 0 && e.code == "invalid_content" =>
            database.transaction(
              UpdateGenerationPhaseMessage(page.currentJobId, GenerationPhase.Repairing, 2).plan
            ) *> generate(config, page, PromptBuilder.repair(prompt, text, e.getMessage), 1)
          case e => IO.raiseError(e)
        }
      case Left(e: AppError)
          if attempt == 0 && Set(
            "provider_content",
            "provider_format",
            "provider_timeout",
            "provider_network",
            "provider_unavailable"
          )(e.code) =>
        database.transaction(
          UpdateGenerationPhaseMessage(page.currentJobId, GenerationPhase.Retrying, 2).plan
        ) *> generate(
          config,
          page,
          prompt + "\n上次接口失败：" + e.getMessage + "\n请返回完整的 PageSpec JSON。",
          1
        )
      case Left(e) => IO.raiseError(e)
    }
