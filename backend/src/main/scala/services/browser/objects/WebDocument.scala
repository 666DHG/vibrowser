package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class WebDocument(
    schemaVersion: Int,
    title: String,
    description: String,
    html: String,
    css: String,
    siteStyle: SiteStyle,
    entities: List[PageEntity],
    bindings: List[WebBinding],
    actions: List[WebAction],
    initialState: Map[String, String],
    persistentKeys: List[String],
    subjectEntityId: Option[String] = None
)
object WebDocument:
  given Encoder[WebDocument] = deriveEncoder
  given Decoder[WebDocument] = deriveDecoder
