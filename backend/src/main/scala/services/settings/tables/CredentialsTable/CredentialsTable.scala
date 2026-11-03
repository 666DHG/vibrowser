package services.settings.tables.CredentialsTable
import cats.effect.IO
import java.sql.Connection
import services.system.SqlExecutor
object CredentialsTable:
  private val getSql = "SELECT ciphertext FROM provider_credentials WHERE id=1"
  def get(c: Connection): IO[Option[Array[Byte]]] = SqlExecutor.query(c,getSql)(_.getBytes("ciphertext")).map(_.headOption)
  private val saveSql = "INSERT INTO provider_credentials VALUES(1,?) ON CONFLICT(id) DO UPDATE SET ciphertext=EXCLUDED.ciphertext"
  def save(c: Connection,encrypted: Array[Byte]): IO[Unit] = SqlExecutor.update(c,saveSql,List(encrypted)).void
  private val clearSql = "DELETE FROM provider_credentials WHERE id=1"
  def clear(c: Connection): IO[Unit] = SqlExecutor.update(c,clearSql).void
