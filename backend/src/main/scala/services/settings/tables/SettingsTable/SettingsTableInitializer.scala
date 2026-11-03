package services.settings.tables.SettingsTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object SettingsTableInitializer:
  private val createSql = """CREATE TABLE IF NOT EXISTS provider_settings (
    id INTEGER PRIMARY KEY CHECK(id=1), base_url TEXT NOT NULL, model TEXT NOT NULL, revision BIGINT NOT NULL)"""
  private val seedSql =
    "INSERT INTO provider_settings VALUES(1,'https://api.deepseek.com','deepseek-flash',1) ON CONFLICT DO NOTHING"
  def initialize(c: Connection): IO[Unit] =
    SqlExecutor.update(c, createSql) *> SqlExecutor.update(c, seedSql).void
