package services.settings.objects.apiTypes
import services.settings.objects.*
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class ClearCredentialsResponse(cleared: Boolean)
object ClearCredentialsResponse:
  given Encoder[ClearCredentialsResponse] = deriveEncoder
  given Decoder[ClearCredentialsResponse] = deriveDecoder
