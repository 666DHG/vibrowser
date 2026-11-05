package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class ResearchSnapshot(
    pageId: PageId,
    topic: String,
    queries: List[String],
    sources: List[ResearchSource],
    candidates: List[ResearchCandidate] = Nil,
    selectedCandidateId: Option[String] = None,
    complete: Boolean = false,
    planningRequests: Int = 0,
    searchRequests: Int = 0,
    fetchRequests: Int = 0
)
object ResearchSnapshot:
  given Encoder[ResearchSnapshot] = deriveEncoder
  given Decoder[ResearchSnapshot] = deriveDecoder
