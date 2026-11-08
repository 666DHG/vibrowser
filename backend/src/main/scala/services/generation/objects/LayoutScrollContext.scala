package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class LayoutScrollContext(
    containerId: String,
    clientWidth: Double,
    scrollWidth: Double,
    viewportLeft: Double,
    viewportRight: Double
)
object LayoutScrollContext:
  given Encoder[LayoutScrollContext] = deriveEncoder
  given Decoder[LayoutScrollContext] = deriveDecoder
