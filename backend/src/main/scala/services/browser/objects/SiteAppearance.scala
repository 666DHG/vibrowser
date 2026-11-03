package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class SiteAppearance(
    title: String,
    description: String,
    theme: Theme,
    design: Option[PageDesign],
    brand: Option[String]
)
object SiteAppearance:
  given Encoder[SiteAppearance] = deriveEncoder
  given Decoder[SiteAppearance] = deriveDecoder
