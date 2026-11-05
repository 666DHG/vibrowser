package services.settings.tables.ResearchSettingsTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
import services.settings.objects.ResearchSettings
import services.settings.tables.SettingsTable.SettingsTable
object ResearchSettingsTable:
  private val readSql =
    "SELECT reuse_generation_key,ciphertext IS NOT NULL AS has_key,revision FROM research_settings WHERE id=1"
  private val keySql = "SELECT ciphertext FROM research_settings WHERE id=1"
  private val saveSql =
    "UPDATE research_settings SET reuse_generation_key=?,ciphertext=coalesce(?,ciphertext),revision=revision+1 WHERE id=1"
  private val clearSql =
    "UPDATE research_settings SET ciphertext=NULL,revision=revision+1 WHERE id=1"
  def get(c: Connection): IO[ResearchSettings] = for
    config <- SettingsTable.get(c)
    allowed = Set("https://api.deepseek.com", "https://api.deepseek.com/v1")(
      config.baseUrl.stripSuffix("/")
    )
    rows <- SqlExecutor.query(c, readSql)(r =>
      ResearchSettings(
        r.getBoolean("reuse_generation_key"),
        if r.getBoolean("reuse_generation_key") then allowed && config.hasKey
        else r.getBoolean("has_key"),
        allowed,
        r.getLong("revision")
      )
    )
  yield rows.head
  def encrypted(c: Connection): IO[Option[Array[Byte]]] =
    SqlExecutor.query(c, keySql)(r => Option(r.getBytes(1))).map(_.headOption.flatten)
  def save(c: Connection, reuse: Boolean, key: Option[Array[Byte]]): IO[Unit] =
    SqlExecutor.update(c, saveSql, List(reuse, key.orNull)).void
  def clear(c: Connection): IO[Unit] = SqlExecutor.update(c, clearSql).void
