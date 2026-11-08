package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class LayoutElement(
    id: String,
    tag: String,
    text: String,
    x: Double,
    y: Double,
    width: Double,
    height: Double,
    fontSize: String,
    lineHeight: String,
    fontFamily: String,
    horizontalScroll: Option[LayoutScrollContext] = None
)
object LayoutElement:
  given Encoder[LayoutElement] = deriveEncoder
  given Decoder[LayoutElement] = deriveDecoder
