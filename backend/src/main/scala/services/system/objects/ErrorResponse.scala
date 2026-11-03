package services.system.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class ErrorResponse(code: String, message: String)
object ErrorResponse:
  given Encoder[ErrorResponse] = deriveEncoder
  given Decoder[ErrorResponse] = deriveDecoder
