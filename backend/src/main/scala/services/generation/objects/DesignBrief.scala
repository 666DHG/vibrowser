package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class DesignBrief(
    purpose: String,
    visitorTask: String,
    contentPriorities: List[String],
    informationStructure: String,
    typography: String,
    interactions: List[String],
    continuity: String,
    rationale: String
)
object DesignBrief:
  given Encoder[DesignBrief] = deriveEncoder
  given Decoder[DesignBrief] = deriveDecoder
