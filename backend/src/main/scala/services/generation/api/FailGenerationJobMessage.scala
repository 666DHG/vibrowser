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

final case class FailGenerationJobMessage(jobId: String, error: String) extends APIMessage[Unit]:
  override def plan(connection: Connection): IO[Unit] =
    for
      job <- GenerationJobTable.findById(connection,jobId)
      changed <- GenerationJobTable.fail(connection,jobId,error.take(500))
      _ <- if changed then job.flatMap(_.pageId).fold(IO.unit)(id => PageTable.markFailed(connection,id,jobId,error.take(500))) else IO.unit
    yield ()
object FailGenerationJobMessage:
  given Decoder[FailGenerationJobMessage] = deriveDecoder
