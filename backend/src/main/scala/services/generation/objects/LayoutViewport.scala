package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class LayoutViewport(
    width: Int,
    height: Int,
    scrollWidth: Double,
    scrollHeight: Double,
    overflowIds: List[String],
    headings: List[LayoutElement],
    controls: List[LayoutElement],
    regions: List[LayoutElement]
)
object LayoutViewport:
  given Encoder[LayoutViewport] = deriveEncoder
  given Decoder[LayoutViewport] = deriveDecoder
