package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class AncestorSummary(address: String, title: String, summary: String)
object AncestorSummary:
  given Encoder[AncestorSummary] = deriveEncoder
  given Decoder[AncestorSummary] = deriveDecoder
