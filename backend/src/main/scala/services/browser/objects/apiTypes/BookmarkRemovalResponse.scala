package services.browser.objects.apiTypes
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class BookmarkRemovalResponse(removed: Boolean)
object BookmarkRemovalResponse:
  given Encoder[BookmarkRemovalResponse] = deriveEncoder
  given Decoder[BookmarkRemovalResponse] = deriveDecoder
