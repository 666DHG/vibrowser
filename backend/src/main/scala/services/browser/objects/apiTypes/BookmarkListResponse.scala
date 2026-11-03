package services.browser.objects.apiTypes
import services.browser.objects.Bookmark
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class BookmarkListResponse(bookmarks: List[Bookmark])
object BookmarkListResponse:
  given Encoder[BookmarkListResponse] = deriveEncoder
  given Decoder[BookmarkListResponse] = deriveDecoder
