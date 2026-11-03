package services.settings.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class ProviderSettings(baseUrl: String, model: String, hasKey: Boolean, revision: Long)
object ProviderSettings:
  given Encoder[ProviderSettings] = deriveEncoder
  given Decoder[ProviderSettings] = deriveDecoder
