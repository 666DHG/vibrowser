package services.generation.tables.GenerationJobTable
import io.circe.syntax.*
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
    GenerationPhase
      .fromString(r.getString("phase"))
      .fold(e => throw new IllegalStateException(e), identity),
    Option(r.getString("error")),
    r.getLong("settings_revision"),
    io.circe.parser.decode[List[GenerationStep]](r.getString("steps")).fold(throw _, identity)
  )
  private val insertSql =
    """INSERT INTO generation_jobs(id,page_id,kind,status,phase,settings_revision,steps)
      VALUES(?,?,?,'queued','queued',?,jsonb_build_array(jsonb_build_object('phase','queued','attempt',1,'at',clock_timestamp())))"""
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
  private val claimSql = """UPDATE generation_jobs SET status='running',phase='preparing',
    steps=steps || jsonb_build_array(jsonb_build_object('phase','preparing','attempt',1,'at',clock_timestamp()))
    WHERE id=(SELECT id FROM generation_jobs WHERE status='queued' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *"""
  def claimNext(c: Connection): IO[Option[GenerationJob]] =
    SqlExecutor.query(c, claimSql)(row).map(_.headOption)
  private val phaseSql = """UPDATE generation_jobs SET phase=?,
    steps=steps || jsonb_build_array(jsonb_build_object('phase',?::text,'attempt',?::int,'at',clock_timestamp()))
    WHERE id=? AND status='running'"""
  def phase(c: Connection, id: JobId, phase: GenerationPhase, attempt: Int): IO[Unit] =
    SqlExecutor
      .update(
        c,
        phaseSql,
        List(GenerationPhase.toString(phase), GenerationPhase.toString(phase), attempt, id.value)
      )
      .void
  private val completeSql =
    """UPDATE generation_jobs SET status='succeeded',phase='ready',
      steps=steps || jsonb_build_array(jsonb_build_object('phase','ready','attempt',coalesce((steps->-1->>'attempt')::int,1),'at',clock_timestamp()))
      WHERE id=? AND status='running'"""
  def complete(c: Connection, id: JobId): IO[Boolean] =
    SqlExecutor.update(c, completeSql, List(id.value)).map(_ == 1)
  private val failSql =
    """UPDATE generation_jobs SET status='failed',phase='failed',error=?,
      steps=steps || jsonb_build_array(jsonb_build_object('phase','failed','attempt',coalesce((steps->-1->>'attempt')::int,1),'at',clock_timestamp()))
      WHERE id=? AND status IN ('queued','running')"""
  def fail(c: Connection, id: JobId, error: String): IO[Boolean] =
    SqlExecutor.update(c, failSql, List(error, id.value)).map(_ == 1)
  private val interruptedSql = "SELECT * FROM generation_jobs WHERE status='running'"
  def interrupted(c: Connection): IO[List[GenerationJob]] =
    SqlExecutor.query(c, interruptedSql)(row)

  private val waitSql =
    "UPDATE generation_jobs SET status='waiting' WHERE id=? AND status='running'"
  private val resumeSql =
    "UPDATE generation_jobs SET status='queued',phase='queued',steps=steps || jsonb_build_array(jsonb_build_object('phase','queued','attempt',1,'at',clock_timestamp())) WHERE id=? AND status='waiting'"
  def waitForChoice(c: Connection, id: JobId): IO[Unit] =
    SqlExecutor.update(c, waitSql, List(id.value)).void
  def resumeChoice(c: Connection, id: JobId): IO[Unit] =
    SqlExecutor.update(c, resumeSql, List(id.value)).void

  private val diagnosticSql =
    "UPDATE generation_jobs SET diagnostics=diagnostics || ?::jsonb WHERE id=? AND status='running'"
  private val readDiagnosticsSql = "SELECT diagnostics::text FROM generation_jobs WHERE id=?"
  def recordAttempt(c: Connection, id: JobId, record: GenerationAttempt): IO[Unit] =
    SqlExecutor.update(c, diagnosticSql, List(List(record).asJson.noSpaces, id.value)).void
  def diagnostics(c: Connection, id: JobId): IO[List[GenerationAttempt]] =
    SqlExecutor
      .query(c, readDiagnosticsSql, List(id.value))(r =>
        io.circe.parser.decode[List[GenerationAttempt]](r.getString(1)).fold(throw _, identity)
      )
      .map(_.headOption.getOrElse(Nil))
