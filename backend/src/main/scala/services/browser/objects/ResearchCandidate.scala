package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class ResearchCandidate(
    id: String,
    title: String,
    description: String,
    sourceIds: List[String]
)
object ResearchCandidate:
  given Encoder[ResearchCandidate] = deriveEncoder
  given Decoder[ResearchCandidate] = deriveDecoder
