package services.generation.tables.GenerationJobTable
import services.browser.objects.PageId
import cats.effect.IO
import java.sql.{Connection, ResultSet}
import services.system.SqlExecutor
import services.generation.objects.*
object GenerationJobTable:
  private def row(r: ResultSet): GenerationJob = GenerationJob(
    JobId(r.getString("id")),
    Option(r.getString("page_id")).map(PageId(_)),
    JobKind.fromString(r.getString("kind")).fold(e => throw new IllegalStateException(e), identity),
    JobStatus
      .fromString(r.getString("status"))
      .fold(e => throw new IllegalStateException(e), identity),
    r.getString("phase"),
    Option(r.getString("error")),
    r.getLong("settings_revision")
  )
  private val insertSql =
    "INSERT INTO generation_jobs(id,page_id,kind,status,phase,settings_revision) VALUES(?,?,?,'queued','queued',?)"
  def insertQueued(
      c: Connection,
      id: JobId,
      pageId: Option[PageId],
      kind: JobKind,
      revision: Long
  ): IO[Unit] =
    SqlExecutor
      .update(
        c,
        insertSql,
        List(id.value, pageId.map(_.value).orNull, JobKind.toString(kind), revision)
      )
      .void
  private val findSql = "SELECT * FROM generation_jobs WHERE id=?"
  def findById(c: Connection, id: JobId): IO[Option[GenerationJob]] =
    SqlExecutor.query(c, findSql, List(id.value))(row).map(_.headOption)
  private val claimSql = """UPDATE generation_jobs SET status='running',phase='generating'
    WHERE id=(SELECT id FROM generation_jobs WHERE status='queued' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *"""
  def claimNext(c: Connection): IO[Option[GenerationJob]] =
    SqlExecutor.query(c, claimSql)(row).map(_.headOption)
  private val phaseSql = "UPDATE generation_jobs SET phase=? WHERE id=? AND status='running'"
  def phase(c: Connection, id: JobId, phase: String): IO[Unit] =
    SqlExecutor.update(c, phaseSql, List(phase, id.value)).void
  private val completeSql =
    "UPDATE generation_jobs SET status='succeeded',phase='ready' WHERE id=? AND status='running'"
  def complete(c: Connection, id: JobId): IO[Boolean] =
    SqlExecutor.update(c, completeSql, List(id.value)).map(_ == 1)
  private val failSql =
    "UPDATE generation_jobs SET status='failed',phase='failed',error=? WHERE id=? AND status IN ('queued','running')"
  def fail(c: Connection, id: JobId, error: String): IO[Boolean] =
    SqlExecutor.update(c, failSql, List(error, id.value)).map(_ == 1)
  private val interruptedSql = "SELECT * FROM generation_jobs WHERE status='running'"
  def interrupted(c: Connection): IO[List[GenerationJob]] =
    SqlExecutor.query(c, interruptedSql)(row)
