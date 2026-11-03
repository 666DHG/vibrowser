package services.browser.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.browser.objects.BookmarkId
import services.browser.objects.apiTypes.BookmarkRemovalResponse
import services.browser.tables.BookmarkTable.BookmarkTable
final case class RemoveBookmarkMessage(bookmarkId: BookmarkId)
    extends APIMessage[BookmarkRemovalResponse]:
  override def plan(connection: Connection): IO[BookmarkRemovalResponse] =
    BookmarkTable.remove(connection, bookmarkId).map(BookmarkRemovalResponse(_))
object RemoveBookmarkMessage:
  given Decoder[RemoveBookmarkMessage] = deriveDecoder
