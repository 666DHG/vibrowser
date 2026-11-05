package services.generation.api
import cats.effect.IO
import java.sql.Connection
import services.system.api.APIMessage
import services.system.objects.AppError
import services.browser.api.ValidateWebDocumentMessage
import services.browser.objects.*
import services.browser.tables.PageTable.PageTable
import services.generation.objects.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
final case class CompleteWebDocumentMessage(jobId: JobId, document: WebDocument, source: String)
    extends APIMessage[Unit]:
  override def plan(connection: Connection): IO[Unit] =
    for
      job <- GenerationJobTable
        .findById(connection, jobId)
        .flatMap(IO.fromOption(_)(AppError("not_found", "任务不存在", 404)))
      _ <-
        if job.status != JobStatus.Running then IO.unit
        else
          for
            page <- PageTable
              .lockById(connection, job.pageId.get)
              .flatMap(IO.fromOption(_)(AppError("not_found", "页面不存在", 404)))
            checked <- ValidateWebDocumentMessage(document, page.address).plan(connection)
            saved <- PageTable.saveDocument(connection, page.id, jobId, checked, source)
            _ <-
              if saved then GenerationJobTable.complete(connection, jobId).void
              else GenerationJobTable.fail(connection, jobId, "任务已过期").void
          yield ()
    yield ()
