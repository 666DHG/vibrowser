package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class DesignGuidanceText(version: String, design: String, review: String)
object DesignGuidanceText:
  given Encoder[DesignGuidanceText] = deriveEncoder
  given Decoder[DesignGuidanceText] = deriveDecoder
