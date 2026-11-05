package services.settings.tables.ResearchSettingsTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object ResearchSettingsTableInitializer:
  private val createSql =
    "CREATE TABLE IF NOT EXISTS research_settings(id INT PRIMARY KEY CHECK(id=1),reuse_generation_key BOOLEAN NOT NULL DEFAULT true,ciphertext BYTEA,revision BIGINT NOT NULL DEFAULT 1)"
  private val seedSql = "INSERT INTO research_settings(id) VALUES(1) ON CONFLICT DO NOTHING"
  def initialize(c: Connection): IO[Unit] =
    SqlExecutor.update(c, createSql) *> SqlExecutor.update(c, seedSql).void
