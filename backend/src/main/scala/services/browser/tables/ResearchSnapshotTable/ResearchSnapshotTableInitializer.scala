package services.browser.tables.ResearchSnapshotTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object ResearchSnapshotTableInitializer:
  private val createSql =
    "CREATE TABLE IF NOT EXISTS research_snapshots(page_id TEXT PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,snapshot JSONB NOT NULL)"
  def initialize(c: Connection): IO[Unit] = SqlExecutor.update(c, createSql).void
