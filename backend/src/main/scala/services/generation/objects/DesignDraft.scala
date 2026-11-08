package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
import services.browser.objects.SiteStyle

final case class DesignDraft(
    title: String,
    description: String,
    html: String,
    css: String,
    siteStyle: SiteStyle
)
object DesignDraft:
  given Encoder[DesignDraft] = deriveEncoder
  given Decoder[DesignDraft] = deriveDecoder
