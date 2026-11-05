package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class ResearchSourcesResponse(sources: List[ResearchSource])
object ResearchSourcesResponse:
  given Encoder[ResearchSourcesResponse] = deriveEncoder
  given Decoder[ResearchSourcesResponse] = deriveDecoder
