package services.companion.tables.CompanionTaskTable
import cats.effect.IO
import java.sql.Connection
import io.circe.syntax.*
import io.circe.parser.decode
import services.system.SqlExecutor
import services.system.objects.AppError
import services.companion.objects.*
object CompanionTaskTable:
  private val lockSql = "LOCK TABLE companion_tasks IN EXCLUSIVE MODE"
  private val countSql = "SELECT count(*) FROM companion_tasks WHERE status IN ('queued','running')"
  private val insertSql =
    "INSERT INTO companion_tasks(id,context,revision,status) VALUES(?,?,?,'queued')"
  def enqueue(c: Connection, task: CompanionTask): IO[Unit] =
    for
      _ <- SqlExecutor.update(c, lockSql)
      count <- SqlExecutor.query(c, countSql)(_.getInt(1)).map(_.head)
      _ <- IO.raiseWhen(count >= 8)(AppError("companion_busy", "小猫正在休息", 429))
      _ <- SqlExecutor.update(
        c,
        insertSql,
        List(task.id, task.context.asJson.noSpaces, task.revision)
      )
    yield ()
  private val claimSql = """UPDATE companion_tasks SET status='running' WHERE id=(
    SELECT id FROM companion_tasks WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING id,context,revision"""
  def claim(c: Connection): IO[Option[CompanionTask]] =
    SqlExecutor.query(c, claimSql)(r => (r.getString(1), r.getString(2), r.getLong(3))).flatMap {
      case Nil => IO.pure(None)
      case (id, context, revision) :: _ =>
        IO.fromEither(decode[CompanionContext](context))
          .map(v => Some(CompanionTask(id, v, revision)))
    }
  private val getSql = "SELECT id,status,reply FROM companion_tasks WHERE id=?"
  def get(c: Connection, id: String): IO[Option[CompanionReply]] =
    SqlExecutor
      .query(c, getSql, List(id))(r =>
        CompanionReply(
          r.getString(1),
          CompanionStatus
            .fromString(r.getString(2))
            .fold(e => throw new IllegalStateException(e), identity),
          Option(r.getString(3)),
          CompanionExpression.Happy
        )
      )
      .map(_.headOption)
  private val finishSql =
    "UPDATE companion_tasks SET status=?,reply=? WHERE id=? AND status='running'"
  def finish(c: Connection, id: String, reply: Option[String]): IO[Unit] =
    SqlExecutor
      .update(
        c,
        finishSql,
        List(if reply.isDefined then "complete" else "failed", reply.orNull, id)
      )
      .void
  private val clearSql = "DELETE FROM companion_tasks"
  def clear(c: Connection): IO[Unit] = SqlExecutor.update(c, clearSql).void
  private val cleanupSql =
    "DELETE FROM companion_tasks WHERE created_at < now() - interval '2 minutes'"
  def cleanup(c: Connection): IO[Unit] = SqlExecutor.update(c, cleanupSql).void
