package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class VisualProfile(
    backgrounds: List[String],
    fonts: List[String],
    headingSizes: List[Double],
    regions: List[VisualRegion]
)
object VisualProfile:
  given Encoder[VisualProfile] = deriveEncoder
  given Decoder[VisualProfile] = deriveDecoder
