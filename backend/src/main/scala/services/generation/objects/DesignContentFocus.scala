package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class DesignContentFocus(
    purpose: String,
    visitorTask: String,
    contentPriorities: List[String]
)
object DesignContentFocus:
  given Encoder[DesignContentFocus] = deriveEncoder
  given Decoder[DesignContentFocus] = deriveDecoder
