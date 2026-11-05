package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class NavigationContext(
    target: String,
    selected: NavigationItem,
    containers: List[AncestorSummary],
    appearance: Option[SiteAppearance],
    entities: List[PageEntity],
    ancestors: List[AncestorSummary],
    siteStyle: Option[SiteStyle] = None
)
object NavigationContext:
  given Encoder[NavigationContext] = deriveEncoder
  given Decoder[NavigationContext] = deriveDecoder
