package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class PageActionSnapshot(
    requestId: String,
    sourcePageId: PageId,
    resultPageId: PageId,
    action: WebAction,
    values: Map[String, String],
    revision: String,
    document: WebDocument
)
object PageActionSnapshot:
  given Encoder[PageActionSnapshot] = deriveEncoder
  given Decoder[PageActionSnapshot] = deriveDecoder
