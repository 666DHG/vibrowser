package services.browser.tables.PageTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object PageTableInitializer:
  private val createSql = """CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY, address TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('website','search')),
    prompt TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('generating','ready','failed')),
    spec JSONB, current_job_id TEXT NOT NULL, referrer_id TEXT REFERENCES pages(id), error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK(status != 'ready' OR spec IS NOT NULL))"""
  private val sourceSql =
    "ALTER TABLE pages ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'pending'"
  private val contextSql = "ALTER TABLE pages ADD COLUMN IF NOT EXISTS navigation_context JSONB"
  private val cachePolicySql = "ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_address_key"
  private val activeIndexSql =
    "CREATE UNIQUE INDEX IF NOT EXISTS one_pending_page_per_address ON pages(address) WHERE status='generating' AND source != 'action'"
  private val documentSql = "ALTER TABLE pages ADD COLUMN IF NOT EXISTS document JSONB"
  private val readyConstraintSql = "ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_check"
  private val documentConstraintSql =
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pages_ready_content' AND conrelid='pages'::regclass) THEN ALTER TABLE pages ADD CONSTRAINT pages_ready_content CHECK(status != 'ready' OR ((spec IS NOT NULL)::int + (document IS NOT NULL)::int = 1)); END IF; END $$"
  private val dropIndexSql = "DROP INDEX IF EXISTS one_pending_page_per_address"
  def initialize(c: Connection): IO[Unit] =
    SqlExecutor.update(c, createSql) *> SqlExecutor
      .update(c, sourceSql) *> SqlExecutor.update(c, contextSql) *> SqlExecutor.update(
      c,
      cachePolicySql
    ) *> SqlExecutor.update(c, dropIndexSql) *> SqlExecutor
      .update(c, activeIndexSql) *> SqlExecutor.update(c, documentSql) *> SqlExecutor
      .update(c, readyConstraintSql) *> SqlExecutor.update(c, documentConstraintSql).void
