package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class NavigationItem(
    blockId: String,
    kind: BlockType,
    target: String,
    title: Option[String],
    text: Option[String],
    meta: Option[String]
)
object NavigationItem:
  given Encoder[NavigationItem] = deriveEncoder
  given Decoder[NavigationItem] = deriveDecoder
