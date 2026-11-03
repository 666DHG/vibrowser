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
    r.getString("source")
  )
  private val findByIdSql = "SELECT * FROM pages WHERE id=?"
  def findById(c: Connection, id: PageId): IO[Option[PageRecord]] =
    SqlExecutor.query(c, findByIdSql, List(id.value))(row).map(_.headOption)
  private val findByAddressSql = "SELECT * FROM pages WHERE address=?"
  def findByAddress(c: Connection, address: String): IO[Option[PageRecord]] =
    SqlExecutor.query(c, findByAddressSql, List(address))(row).map(_.headOption)
  private val lockSql = "SELECT * FROM pages WHERE id=? FOR UPDATE"
  def lockById(c: Connection, id: PageId): IO[Option[PageRecord]] =
    SqlExecutor.query(c, lockSql, List(id.value))(row).map(_.headOption)
  private val insertSql =
    "INSERT INTO pages(id,address,kind,prompt,status,current_job_id,referrer_id) VALUES(?,?,?,?,'generating',?,?) ON CONFLICT(address) DO NOTHING"
  def insertPending(
      c: Connection,
      id: PageId,
      address: VirtualAddress,
      jobId: JobId,
      referrer: Option[PageId]
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
          referrer.map(_.value).orNull
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
