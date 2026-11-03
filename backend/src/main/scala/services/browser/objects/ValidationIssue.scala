package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class ValidationIssue(path: String, message: String)
object ValidationIssue:
  given Encoder[ValidationIssue] = deriveEncoder
  given Decoder[ValidationIssue] = deriveDecoder
