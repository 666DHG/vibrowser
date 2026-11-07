package services.browser.tables.BookmarkTable
import io.circe.syntax.*
import cats.effect.IO
import java.sql.{Connection, ResultSet}
import services.system.SqlExecutor
import services.browser.objects.*
import services.generation.objects.GenerationEffort
object BookmarkTable:
  private def row(r: ResultSet): Bookmark = Bookmark(
    BookmarkId(r.getString("id")),
    PageId(r.getString("page_id")),
    r.getString("title"),
    r.getString("address"),
    PageKind
      .fromString(r.getString("kind"))
      .fold(e => throw new IllegalStateException(e), identity),
    r.getTimestamp("saved_at").toInstant.toString,
    BrowsingMode
      .fromString(r.getString("mode"))
      .fold(e => throw new IllegalStateException(e), identity),
    GenerationEffort
      .fromString(r.getString("effort"))
      .fold(e => throw new IllegalStateException(e), identity)
  )
  private val listSql =
    "SELECT b.*, p.mode, p.effort FROM bookmarks b JOIN pages p ON p.id=b.page_id ORDER BY b.saved_at DESC,b.id"
  def list(c: Connection): IO[List[Bookmark]] = SqlExecutor.query(c, listSql)(row)
  private val saveSql =
    """INSERT INTO bookmarks(id,page_id,title,address,kind,state) VALUES(?,?,?,?,?,?::jsonb)
    ON CONFLICT(page_id) DO UPDATE SET page_id=EXCLUDED.page_id RETURNING *"""
  def save(
      c: Connection,
      id: BookmarkId,
      page: PageRecord,
      title: String,
      state: Map[String, String]
  ): IO[Bookmark] =
    SqlExecutor
      .query(
        c,
        saveSql,
        List(
          id.value,
          page.id.value,
          title,
          page.address,
          PageKind.toString(page.kind),
          state.asJson.noSpaces
        )
      )(r =>
        Bookmark(
          BookmarkId(r.getString("id")),
          page.id,
          title,
          page.address,
          page.kind,
          r.getTimestamp("saved_at").toInstant.toString,
          page.mode,
          page.effort
        )
      )
      .map(_.head)
  private val removeSql = "DELETE FROM bookmarks WHERE id=?"
  def remove(c: Connection, id: BookmarkId): IO[Boolean] =
    SqlExecutor.update(c, removeSql, List(id.value)).map(_ == 1)

  private val readStateSql = "SELECT state::text FROM bookmarks WHERE page_id=?"
  def state(c: Connection, page: PageId): IO[Map[String, String]] =
    SqlExecutor
      .query(c, readStateSql, List(page.value))(r =>
        io.circe.parser.decode[Map[String, String]](r.getString(1)).fold(throw _, identity)
      )
      .map(_.headOption.getOrElse(Map.empty))
