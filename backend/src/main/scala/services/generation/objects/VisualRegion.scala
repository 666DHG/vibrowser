package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class VisualRegion(display: String, columns: Int, widthRatio: Double)
object VisualRegion:
  given Encoder[VisualRegion] = deriveEncoder
  given Decoder[VisualRegion] = deriveDecoder
