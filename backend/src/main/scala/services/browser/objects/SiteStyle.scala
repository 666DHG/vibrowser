package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class SiteStyle(brand: String, typography: String, palette: String, layout: String)
object SiteStyle:
  given Encoder[SiteStyle] = deriveEncoder
  given Decoder[SiteStyle] = deriveDecoder
