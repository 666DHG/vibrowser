package services.browser.objects
import io.circe.{Encoder, Decoder}
final case class BookmarkId(value: String)
object BookmarkId:
  given Encoder[BookmarkId] = Encoder.encodeString.contramap(_.value)
  given Decoder[BookmarkId] = Decoder.decodeString.map(BookmarkId(_))
