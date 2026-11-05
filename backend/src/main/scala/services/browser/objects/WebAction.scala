package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class WebAction(
    id: String,
    kind: WebActionKind,
    elementId: String,
    target: Option[String] = None,
    region: Option[String] = None,
    stateKey: Option[String] = None,
    value: Option[String] = None,
    field: Option[String] = None
)
object WebAction:
  given Encoder[WebAction] = deriveEncoder
  given Decoder[WebAction] = deriveDecoder
