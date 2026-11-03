package services.settings.objects.apiTypes
import services.generation.objects.JobId
import services.settings.objects.*
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class ConnectionTestResponse(jobId: JobId)
object ConnectionTestResponse:
  given Encoder[ConnectionTestResponse] = deriveEncoder
  given Decoder[ConnectionTestResponse] = deriveDecoder
