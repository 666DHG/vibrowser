package services.settings.tables.CredentialsTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object CredentialsTableInitializer:
  private val createSql =
    "CREATE TABLE IF NOT EXISTS provider_credentials(id INTEGER PRIMARY KEY REFERENCES provider_settings(id), ciphertext BYTEA NOT NULL)"
  def initialize(c: Connection): IO[Unit] = SqlExecutor.update(c, createSql).void
