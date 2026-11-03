package services.generation.utils
import cats.effect.IO
import cats.syntax.all.*
import scala.concurrent.duration.*
import io.circe.parser.decode
import services.system.DatabaseSession
import services.system.objects.AppError
import services.generation.api.*
import services.generation.objects.*
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
          client
            .complete(config, "Return JSON only.", "Return {\"ok\":true}", true)
            .as(Option.empty[PageSpec])
        case Some(id) =>
          for
            page <- database
              .transaction(c => PageTable.findById(c, id))
              .flatMap(IO.fromOption(_)(AppError("not_found", "页面不存在", 404)))
            source <- page.referrerId.fold(IO.pure(Option.empty[PageRecord]))(ref =>
              database.transaction(c => PageTable.findById(c, ref))
            )
            spec <- generate(config, page, PromptBuilder.request(page, source), 0)
          yield Some(spec)
      _ <- database.transaction(UpdateGenerationPhaseMessage(job.id, "saving").plan)
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
    val action = for
      text <- client.complete(config, PromptBuilder.system, prompt, false)
      _ <- database.transaction(UpdateGenerationPhaseMessage(page.currentJobId, "validating").plan)
      spec <- IO.fromEither(
        decode[PageSpec](text).left.map(_ =>
          AppError("invalid_content", "生成 JSON 字段不符合 PageSpec", 502)
        )
      )
      issues <- database.transaction(ValidateGeneratedContentMessage(spec, page.address).plan)
      _ <- IO.raiseWhen(issues.nonEmpty)(
        AppError(
          "invalid_content",
          issues.take(6).map(i => i.path + ": " + i.message).mkString("; "),
          502
        )
      )
    yield spec
    action.handleErrorWith {
      case e: AppError
          if attempt == 0 && Set(
            "invalid_content",
            "provider_content",
            "provider_format",
            "provider_timeout",
            "provider_network",
            "provider_unavailable"
          )(e.code) =>
        generate(config, page, prompt + "\n上次失败：" + e.getMessage + "\n请重新返回符合全部限制的 JSON。", 1)
      case e => IO.raiseError(e)
    }
