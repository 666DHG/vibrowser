package services.browser.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.system.objects.AppError
import services.browser.objects.*
import services.browser.objects.apiTypes.*
import services.browser.tables.PageTable.PageTable
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.generation.objects.*
import services.settings.tables.SettingsTable.SettingsTable

final case class RetryPageMessage(pageId: PageId, failedJobId: JobId)
    extends APIMessage[NavigationResponse]:
  override def plan(connection: Connection): IO[NavigationResponse] =
    for
      page <- PageTable
        .lockById(connection, pageId)
        .flatMap(IO.fromOption(_)(AppError("not_found", "页面不存在", 404)))
      result <-
        if page.currentJobId != failedJobId || page.status != PageStatus.Failed then
          IO.pure(NavigationResponse(page.id, page.currentJobId, page.status))
        else
          for
            snapshot <- services.browser.tables.PageActionTable.PageActionTable
              .forPage(connection, pageId)
            config <- SettingsTable.get(connection)
            jobId <- IO(JobId(java.util.UUID.randomUUID().toString))
            _ <- PageTable.retry(connection, pageId, failedJobId, jobId)
            _ <- GenerationJobTable.insertQueued(
              connection,
              jobId,
              Some(pageId),
              if snapshot.nonEmpty then JobKind.Action else JobKind.Page,
              config.revision
            )
            _ <- GenerationJobTable.copyDesignWorkflow(connection, failedJobId, jobId)
          yield NavigationResponse(pageId, jobId, PageStatus.Generating)
    yield result
object RetryPageMessage:
  given Decoder[RetryPageMessage] = deriveDecoder
