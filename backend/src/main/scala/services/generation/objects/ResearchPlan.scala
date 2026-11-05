package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class ResearchPlan(
    topic: String,
    queries: List[String],
    reuseSources: Boolean = false,
    candidates: List[services.browser.objects.ResearchCandidate] = Nil
)
object ResearchPlan:
  given Encoder[ResearchPlan] = deriveEncoder
  given Decoder[ResearchPlan] = deriveDecoder
