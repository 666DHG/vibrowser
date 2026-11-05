package services.browser.tables.BookmarkTable
import cats.effect.IO
import java.sql.{Connection, ResultSet}
import services.system.SqlExecutor
import services.browser.objects.*
object BookmarkTable:
  private def row(r: ResultSet): Bookmark = Bookmark(
    BookmarkId(r.getString("id")),
    PageId(r.getString("page_id")),
    r.getString("title"),
    r.getString("address"),
    PageKind
      .fromString(r.getString("kind"))
      .fold(e => throw new IllegalStateException(e), identity),
    r.getTimestamp("saved_at").toInstant.toString
  )
  private val listSql = "SELECT * FROM bookmarks ORDER BY saved_at DESC,id"
  def list(c: Connection): IO[List[Bookmark]] = SqlExecutor.query(c, listSql)(row)
  private val saveSql = """INSERT INTO bookmarks(id,page_id,title,address,kind) VALUES(?,?,?,?,?)
    ON CONFLICT(page_id) DO UPDATE SET page_id=EXCLUDED.page_id RETURNING *"""
  def save(c: Connection, id: BookmarkId, page: PageRecord, title: String): IO[Bookmark] =
    SqlExecutor
      .query(
        c,
        saveSql,
        List(id.value, page.id.value, title, page.address, PageKind.toString(page.kind))
      )(row)
      .map(_.head)
  private val removeSql = "DELETE FROM bookmarks WHERE id=?"
  def remove(c: Connection, id: BookmarkId): IO[Boolean] =
    SqlExecutor.update(c, removeSql, List(id.value)).map(_ == 1)

  private val stateSql = "UPDATE bookmarks SET state=?::jsonb WHERE id=? AND state='{}'::jsonb"
  def saveState(c: Connection, id: BookmarkId, state: Map[String, String]): IO[Unit] =
    import io.circe.syntax.*
    SqlExecutor.update(c, stateSql, List(state.asJson.noSpaces, id.value)).void
  private val readStateSql = "SELECT state::text FROM bookmarks WHERE page_id=?"
  def state(c: Connection, page: PageId): IO[Map[String, String]] =
    SqlExecutor
      .query(c, readStateSql, List(page.value))(r =>
        io.circe.parser.decode[Map[String, String]](r.getString(1)).fold(throw _, identity)
      )
      .map(_.headOption.getOrElse(Map.empty))
