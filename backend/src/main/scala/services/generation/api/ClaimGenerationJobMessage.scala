package services.generation.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.NoRequestMessage
import services.system.objects.AppError
import services.generation.objects.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.browser.tables.PageTable.PageTable
import services.browser.objects.*
import services.browser.api.ValidateGeneratedContentMessage

final case class ClaimGenerationJobMessage() extends NoRequestMessage[Option[GenerationJob]]:
  override def plan(connection: Connection): IO[Option[GenerationJob]] =
    GenerationJobTable.claimNext(connection)
object ClaimGenerationJobMessage:
  given Decoder[ClaimGenerationJobMessage] = deriveDecoder
