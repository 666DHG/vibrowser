package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class PageBlock(
    id: String,
    `type`: BlockType,
    title: Option[String],
    text: Option[String],
    target: Option[String],
    items: List[PageBlock],
    meta: Option[String] = None,
    style: Option[BlockStyle] = None
)
object PageBlock:
  given Encoder[PageBlock] = deriveEncoder
  given Decoder[PageBlock] = deriveDecoder
