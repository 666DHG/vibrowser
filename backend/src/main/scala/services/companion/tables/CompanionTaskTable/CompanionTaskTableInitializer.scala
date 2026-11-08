package services.companion.tables.CompanionTaskTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object CompanionTaskTableInitializer:
  private val createSql = """CREATE TABLE IF NOT EXISTS companion_tasks (
    id text PRIMARY KEY, context text NOT NULL, revision bigint NOT NULL,
    status text NOT NULL, reply text, created_at timestamptz NOT NULL DEFAULT now())"""
  def initialize(c: Connection): IO[Unit] = SqlExecutor.update(c, createSql).void
