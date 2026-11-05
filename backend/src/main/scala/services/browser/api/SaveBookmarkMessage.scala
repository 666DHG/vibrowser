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
final case class SaveBookmarkMessage(pageId: PageId, state: Option[Map[String, String]] = None)
    extends APIMessage[Bookmark]:
  override def plan(connection: Connection): IO[Bookmark] =
    for
      page <- PageTable
        .findById(connection, pageId)
        .flatMap(IO.fromOption(_)(AppError("not_found", "页面不存在", 404)))
      _ <- IO.raiseUnless(
        page.status == PageStatus.Ready && (page.spec.nonEmpty || page.document.nonEmpty)
      )(
        AppError("page_not_ready", "只能收藏已加载的网页")
      )
      id <- IO(BookmarkId(java.util.UUID.randomUUID().toString))
      accepted = state
        .getOrElse(Map.empty)
        .filter((key, value) =>
          page.document.exists(_.persistentKeys.contains(key)) && value.length <= 2000
        )
      saved <- BookmarkTable.save(
        connection,
        id,
        page,
        page.document.map(_.title).getOrElse(page.spec.get.title),
        accepted
      )
    yield saved
object SaveBookmarkMessage:
  given Decoder[SaveBookmarkMessage] = deriveDecoder
