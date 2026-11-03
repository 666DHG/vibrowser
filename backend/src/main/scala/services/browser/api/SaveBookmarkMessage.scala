package services.browser.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.system.objects.AppError
import services.browser.objects.*
import services.browser.tables.PageTable.PageTable
import services.browser.tables.BookmarkTable.BookmarkTable
final case class SaveBookmarkMessage(pageId: PageId) extends APIMessage[Bookmark]:
  override def plan(connection: Connection): IO[Bookmark] =
    for
      page <- PageTable
        .findById(connection, pageId)
        .flatMap(IO.fromOption(_)(AppError("not_found", "页面不存在", 404)))
      _ <- IO.raiseUnless(page.status == PageStatus.Ready && page.spec.nonEmpty)(
        AppError("page_not_ready", "只能收藏已加载的网页")
      )
      id <- IO(BookmarkId(java.util.UUID.randomUUID().toString))
      saved <- BookmarkTable.save(connection, id, page, page.spec.get.title)
    yield saved
object SaveBookmarkMessage:
  given Decoder[SaveBookmarkMessage] = deriveDecoder
