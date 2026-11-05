package services.browser.tables.PageActionTable
import cats.effect.IO
import java.sql.Connection
import io.circe.syntax.*
import io.circe.parser.decode
import services.browser.objects.*
import services.system.SqlExecutor
object PageActionTable:
  private val findSql = "SELECT snapshot::text FROM page_actions WHERE request_id=?"
  def find(c: Connection, request: String): IO[Option[PageActionSnapshot]] = SqlExecutor
    .query(c, findSql, List(request))(r =>
      decode[PageActionSnapshot](r.getString(1)).fold(throw _, identity)
    )
    .map(_.headOption)
  private val pageSql = "SELECT snapshot::text FROM page_actions WHERE result_page_id=?"
  def forPage(c: Connection, page: PageId): IO[Option[PageActionSnapshot]] = SqlExecutor
    .query(c, pageSql, List(page.value))(r =>
      decode[PageActionSnapshot](r.getString(1)).fold(throw _, identity)
    )
    .map(_.headOption)
  private val saveSql =
    "INSERT INTO page_actions(request_id,result_page_id,snapshot) VALUES(?,?,?::jsonb)"
  def insert(c: Connection, snapshot: PageActionSnapshot): IO[Unit] = SqlExecutor
    .update(
      c,
      saveSql,
      List(snapshot.requestId, snapshot.resultPageId.value, snapshot.asJson.noSpaces)
    )
    .void
  private val lockSql = "SELECT pg_advisory_xact_lock(hashtextextended(?,0))"
  def lockRequest(c: Connection, request: String): IO[Unit] =
    SqlExecutor.query(c, lockSql, List(request))(_ => ()).void
