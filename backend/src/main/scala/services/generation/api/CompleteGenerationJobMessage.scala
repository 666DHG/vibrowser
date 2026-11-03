package services.generation.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.system.objects.AppError
import services.generation.objects.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.browser.tables.PageTable.PageTable
import services.browser.objects.*
import services.browser.api.ValidateGeneratedContentMessage

final case class CompleteGenerationJobMessage(jobId: String, spec: Option[PageSpec]) extends APIMessage[Unit]:
  override def plan(connection: Connection): IO[Unit] =
    for
      job <- GenerationJobTable.findById(connection,jobId).flatMap(IO.fromOption(_)(AppError("not_found","任务不存在",404)))
      _ <- if job.status != JobStatus.Running then IO.unit
        else job.pageId match
          case None => GenerationJobTable.complete(connection,jobId).void
          case Some(pageId) =>
            for
              page <- PageTable.lockById(connection,pageId).flatMap(IO.fromOption(_)(AppError("not_found","页面不存在",404)))
              content <- IO.fromOption(spec)(AppError("invalid_content","生成内容缺失"))
              issues <- ValidateGeneratedContentMessage(content,page.address).plan(connection)
              _ <- IO.raiseWhen(issues.nonEmpty)(AppError("invalid_content","生成结构未通过校验"))
              saved <- PageTable.saveReady(connection,pageId,jobId,content)
              _ <- if saved then GenerationJobTable.complete(connection,jobId).void
                   else GenerationJobTable.fail(connection,jobId,"任务已过期").void
            yield ()
    yield ()
object CompleteGenerationJobMessage:
  given Decoder[CompleteGenerationJobMessage] = deriveDecoder
