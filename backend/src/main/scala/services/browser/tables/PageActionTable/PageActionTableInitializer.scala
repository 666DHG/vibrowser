package services.browser.tables.PageActionTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object PageActionTableInitializer:
  private val createSql =
    "CREATE TABLE IF NOT EXISTS page_actions(request_id TEXT PRIMARY KEY,result_page_id TEXT NOT NULL UNIQUE REFERENCES pages(id) ON DELETE CASCADE,snapshot JSONB NOT NULL)"
  def initialize(c: Connection): IO[Unit] = SqlExecutor.update(c, createSql).void
