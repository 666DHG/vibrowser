package services.browser.tables.ResearchSnapshotTable
import cats.effect.IO
import java.sql.Connection
import io.circe.parser.decode
import io.circe.syntax.*
import services.system.SqlExecutor
import services.browser.objects.*
object ResearchSnapshotTable:
  private val findSql = "SELECT snapshot::text FROM research_snapshots WHERE page_id=?"
  private val saveSql =
    "INSERT INTO research_snapshots(page_id,snapshot) VALUES(?,?::jsonb) ON CONFLICT(page_id) DO UPDATE SET snapshot=EXCLUDED.snapshot"
  def get(c: Connection, id: PageId): IO[Option[ResearchSnapshot]] = SqlExecutor
    .query(c, findSql, List(id.value))(r =>
      decode[ResearchSnapshot](r.getString(1)).fold(throw _, identity)
    )
    .map(_.headOption)
  def save(c: Connection, snapshot: ResearchSnapshot): IO[Unit] =
    SqlExecutor.update(c, saveSql, List(snapshot.pageId.value, snapshot.asJson.noSpaces)).void
