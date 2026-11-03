package services.browser.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.NoRequestMessage
import services.browser.objects.apiTypes.BookmarkListResponse
import services.browser.tables.BookmarkTable.BookmarkTable
final case class ListBookmarksMessage() extends NoRequestMessage[BookmarkListResponse]:
  override def plan(connection: Connection): IO[BookmarkListResponse] =
    BookmarkTable.list(connection).map(BookmarkListResponse(_))
object ListBookmarksMessage:
  given Decoder[ListBookmarksMessage] = deriveDecoder
