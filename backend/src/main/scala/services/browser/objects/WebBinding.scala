package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class WebBinding(elementId: String, entityId: String, field: EntityField)
object WebBinding:
  given Encoder[WebBinding] = deriveEncoder
  given Decoder[WebBinding] = deriveDecoder
