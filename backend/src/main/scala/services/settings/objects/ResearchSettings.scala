package services.settings.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class ResearchSettings(
    reuseGenerationKey: Boolean,
    hasKey: Boolean,
    canReuseGenerationKey: Boolean,
    revision: Long
)
object ResearchSettings:
  given Encoder[ResearchSettings] = deriveEncoder
  given Decoder[ResearchSettings] = deriveDecoder
