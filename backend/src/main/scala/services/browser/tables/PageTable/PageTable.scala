package services.browser.tables.PageTable
import services.generation.objects.JobId
import cats.effect.IO
import java.sql.{Connection, ResultSet}
import io.circe.parser.decode
import io.circe.syntax.*
import services.browser.objects.*
import services.system.SqlExecutor
object PageTable:
  private def row(r: ResultSet): PageRecord = PageRecord(
    PageId(r.getString("id")),
    r.getString("address"),
    PageKind
      .fromString(r.getString("kind"))
      .fold(e => throw new IllegalStateException(e), identity),
    r.getString("prompt"),
    PageStatus
      .fromString(r.getString("status"))
      .fold(e => throw new IllegalStateException(e), identity),
    Option(r.getString("spec")).map(s => decode[PageSpec](s).fold(throw _, identity)),
    JobId(r.getString("current_job_id")),
    Option(r.getString("referrer_id")).map(PageId(_)),
    Option(r.getString("error")),
    r.getString("source"),
    Option(r.getString("navigation_context")).map(s =>
      decode[NavigationContext](s).fold(throw _, identity)
    ),
    Option(r.getString("document")).map(s => decode[WebDocument](s).fold(throw _, identity))
  )
  private val findByIdSql = "SELECT * FROM pages WHERE id=?"
  def findById(c: Connection, id: PageId): IO[Option[PageRecord]] =
    SqlExecutor.query(c, findByIdSql, List(id.value))(row).map(_.headOption)
  private val findByAddressSql =
    "SELECT p.* FROM pages p WHERE address=? AND ((status='generating' AND source != 'action') OR EXISTS (SELECT 1 FROM bookmarks b WHERE b.page_id=p.id)) ORDER BY CASE WHEN status='ready' THEN 0 ELSE 1 END, created_at DESC LIMIT 1"
  def findByAddress(c: Connection, address: String): IO[Option[PageRecord]] =
    SqlExecutor.query(c, findByAddressSql, List(address))(row).map(_.headOption)
  private val detachTemporaryParentsSql =
    "UPDATE pages SET referrer_id=NULL WHERE referrer_id IN (SELECT id FROM pages WHERE id NOT IN (SELECT page_id FROM bookmarks))"
  private val clearTemporaryJobsSql =
    "DELETE FROM generation_jobs WHERE page_id IN (SELECT id FROM pages WHERE id NOT IN (SELECT page_id FROM bookmarks))"
  private val clearTemporaryPagesSql =
    "DELETE FROM pages WHERE id NOT IN (SELECT page_id FROM bookmarks)"
  def clearTemporary(c: Connection): IO[Unit] =
    SqlExecutor.update(c, detachTemporaryParentsSql) *> SqlExecutor.update(
      c,
      clearTemporaryJobsSql
    ) *> SqlExecutor.update(c, clearTemporaryPagesSql).void
  private val lockSql = "SELECT * FROM pages WHERE id=? FOR UPDATE"
  def lockById(c: Connection, id: PageId): IO[Option[PageRecord]] =
    SqlExecutor.query(c, lockSql, List(id.value))(row).map(_.headOption)
  private val insertSql =
    "INSERT INTO pages(id,address,kind,prompt,status,current_job_id,referrer_id,navigation_context) VALUES(?,?,?,?,'generating',?,?,?::jsonb) ON CONFLICT(address) WHERE status='generating' AND source != 'action' DO NOTHING"
  def insertPending(
      c: Connection,
      id: PageId,
      address: VirtualAddress,
      jobId: JobId,
      referrer: Option[PageId],
      context: Option[NavigationContext] = None
  ): IO[Boolean] =
    SqlExecutor
      .update(
        c,
        insertSql,
        List(
          id.value,
          address.canonical,
          PageKind.toString(address.kind),
          address.prompt,
          jobId.value,
          referrer.map(_.value).orNull,
          context.map(_.asJson.noSpaces).orNull
        )
      )
      .map(_ == 1)
  private val saveReadySql =
    "UPDATE pages SET status='ready',spec=?::jsonb,error=NULL,source=? WHERE id=? AND current_job_id=? AND status='generating'"
  def saveReady(
      c: Connection,
      id: PageId,
      jobId: JobId,
      spec: PageSpec,
      source: String
  ): IO[Boolean] =
    SqlExecutor
      .update(c, saveReadySql, List(spec.asJson.noSpaces, source, id.value, jobId.value))
      .map(_ == 1)
  private val failSql =
    "UPDATE pages SET status='failed',error=? WHERE id=? AND current_job_id=? AND status='generating'"
  def markFailed(c: Connection, id: PageId, jobId: JobId, error: String): IO[Unit] =
    SqlExecutor.update(c, failSql, List(error, id.value, jobId.value)).void
  private val retrySql =
    "UPDATE pages SET status='generating',error=NULL,current_job_id=? WHERE id=? AND status='failed' AND current_job_id=?"
  def retry(c: Connection, id: PageId, oldJob: JobId, newJob: JobId): IO[Boolean] =
    SqlExecutor.update(c, retrySql, List(newJob.value, id.value, oldJob.value)).map(_ == 1)

  private val saveDocumentSql =
    "UPDATE pages SET status='ready',document=?::jsonb,spec=NULL,error=NULL,source=? WHERE id=? AND current_job_id=? AND status='generating'"
  def saveDocument(
      c: Connection,
      id: PageId,
      jobId: JobId,
      document: WebDocument,
      source: String
  ): IO[Boolean] =
    SqlExecutor
      .update(c, saveDocumentSql, List(document.asJson.noSpaces, source, id.value, jobId.value))
      .map(_ == 1)

  private val versionSql =
    "INSERT INTO pages(id,address,kind,prompt,status,current_job_id,referrer_id,navigation_context,source) VALUES(?,?,?,?,'generating',?,?,?::jsonb,'action')"
  def insertVersion(
      c: Connection,
      id: PageId,
      address: VirtualAddress,
      jobId: JobId,
      source: PageRecord
  ): IO[Unit] =
    SqlExecutor
      .update(
        c,
        versionSql,
        List(
          id.value,
          address.canonical,
          PageKind.toString(address.kind),
          address.prompt,
          jobId.value,
          source.id.value,
          source.navigationContext.map(_.asJson.noSpaces).orNull
        )
      )
      .void
