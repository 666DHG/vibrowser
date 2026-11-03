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

final case class GetPageMessage(pageId: Option[String], jobId: Option[String]) extends APIMessage[PageResponse]:
  override def plan(connection: Connection): IO[PageResponse] =
    for
      _ <- IO.raiseWhen(pageId.isDefined == jobId.isDefined)(AppError("invalid_request","请指定一个页面或任务"))
      page <- pageId.fold(IO.pure(Option.empty[PageRecord]))(PageTable.findById(connection,_))
      _ <- IO.raiseWhen(pageId.nonEmpty && page.isEmpty)(AppError("not_found","页面不存在",404))
      job <- page.map(_.currentJobId).orElse(jobId).fold(IO.pure(Option.empty[GenerationJob]))(GenerationJobTable.findById(connection,_))
      _ <- IO.raiseWhen(job.isEmpty)(AppError("not_found","任务不存在",404))
    yield PageResponse(page,job)
object GetPageMessage:
  given Decoder[GetPageMessage] = deriveDecoder
