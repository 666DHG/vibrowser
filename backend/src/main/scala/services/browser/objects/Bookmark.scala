package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class Bookmark(
    id: BookmarkId,
    pageId: PageId,
    title: String,
    address: String,
    kind: PageKind,
    savedAt: String
)
object Bookmark:
  given Encoder[Bookmark] = deriveEncoder
  given Decoder[Bookmark] = deriveDecoder
