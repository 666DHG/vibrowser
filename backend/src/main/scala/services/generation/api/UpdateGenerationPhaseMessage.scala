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

final case class UpdateGenerationPhaseMessage(jobId: JobId, phase: String) extends APIMessage[Unit]:
  override def plan(connection: Connection): IO[Unit] =
    GenerationJobTable.phase(connection, jobId, phase)
object UpdateGenerationPhaseMessage:
  given Decoder[UpdateGenerationPhaseMessage] = deriveDecoder
