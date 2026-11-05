package services.browser.tables.BookmarkTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object BookmarkTableInitializer:
  private val createSql = """CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY, page_id TEXT NOT NULL UNIQUE REFERENCES pages(id),
    title TEXT NOT NULL, address TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('website','search')),
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now())"""
  def initialize(c: Connection): IO[Unit] = SqlExecutor.update(c, createSql) *> SqlExecutor
    .update(
      c,
      "ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS state JSONB NOT NULL DEFAULT '{}'::jsonb"
    )
    .void
