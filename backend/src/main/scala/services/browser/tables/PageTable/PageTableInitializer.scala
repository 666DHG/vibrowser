package services.browser.tables.PageTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object PageTableInitializer:
  private val createSql = """CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY, address TEXT UNIQUE NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('website','search')),
    prompt TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('generating','ready','failed')),
    spec JSONB, current_job_id TEXT NOT NULL, referrer_id TEXT REFERENCES pages(id), error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK(status != 'ready' OR spec IS NOT NULL))"""
  def initialize(c: Connection): IO[Unit] = SqlExecutor.update(c, createSql).void
