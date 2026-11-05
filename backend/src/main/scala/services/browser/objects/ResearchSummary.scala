package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class ResearchSummary(
    sourceCount: Int,
    candidates: List[ResearchCandidate],
    selectedCandidateId: Option[String]
)
object ResearchSummary:
  given Encoder[ResearchSummary] = deriveEncoder
  given Decoder[ResearchSummary] = deriveDecoder
