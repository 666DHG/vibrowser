package services.settings.tables.SettingsTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
import services.settings.objects.ProviderSettings
object SettingsTable:
  private val readSql =
    """SELECT s.*, EXISTS(SELECT 1 FROM provider_credentials WHERE id=1) AS has_key FROM provider_settings s WHERE id=1"""
  def get(c: Connection): IO[ProviderSettings] =
    SqlExecutor
      .query(c, readSql)(r =>
        ProviderSettings(
          r.getString("base_url"),
          r.getString("model"),
          r.getBoolean("has_key"),
          r.getLong("revision")
        )
      )
      .map(_.head)
  private val lockSql = "SELECT id FROM provider_settings WHERE id=1 FOR UPDATE"
  def lock(c: Connection): IO[Unit] = SqlExecutor.query(c, lockSql)(_.getInt("id")).void
  private val saveSql =
    "UPDATE provider_settings SET base_url=?,model=?,revision=revision+1 WHERE id=1"
  def save(c: Connection, url: String, model: String): IO[Unit] =
    SqlExecutor.update(c, saveSql, List(url, model)).void
