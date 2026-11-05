package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class LayoutReport(viewports: List[LayoutViewport], error: Option[String] = None)
object LayoutReport:
  given Encoder[LayoutReport] = deriveEncoder
  given Decoder[LayoutReport] = deriveDecoder
