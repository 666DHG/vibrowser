package services.generation.tables.GenerationJobTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object GenerationJobTableInitializer:
  private val createSql = """CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY, page_id TEXT REFERENCES pages(id), kind TEXT NOT NULL CHECK(kind IN ('page','connection')),
    status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
    phase TEXT NOT NULL, error TEXT, settings_revision BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK((kind='page' AND page_id IS NOT NULL) OR (kind='connection' AND page_id IS NULL)))"""
  private val indexSql =
    "CREATE UNIQUE INDEX IF NOT EXISTS one_active_job_per_page ON generation_jobs(page_id) WHERE status IN ('queued','running')"
  private val stepsSql =
    "ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS steps JSONB NOT NULL DEFAULT '[]'::jsonb"
  def initialize(c: Connection): IO[Unit] =
    SqlExecutor.update(c, createSql) *> SqlExecutor
      .update(c, stepsSql) *> SqlExecutor.update(c, indexSql).void
