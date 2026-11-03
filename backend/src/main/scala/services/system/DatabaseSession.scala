package services.system
import cats.effect.{IO, Resource}
import com.zaxxer.hikari.{HikariConfig, HikariDataSource}
import java.sql.Connection
final class DatabaseSession private (pool: HikariDataSource):
  def transaction[A](run: Connection => IO[A]): IO[A] =
    Resource.make(IO.blocking(pool.getConnection))(c => IO.blocking(c.close())).use { connection =>
      IO.blocking(connection.setAutoCommit(false)) *>
        run(connection)
          .flatTap(_ => IO.blocking(connection.commit()))
          .onError(_ => IO.blocking(connection.rollback()))
          .onCancel(IO.blocking(connection.rollback()))
    }
object DatabaseSession:
  def resource(url: String, user: String, password: String): Resource[IO, DatabaseSession] =
    Resource
      .make(IO.blocking {
        val config = new HikariConfig()
        config.setJdbcUrl(url)
        config.setUsername(user)
        config.setPassword(password)
        config.setMaximumPoolSize(4)
        config.setConnectionTimeout(5000)
        new HikariDataSource(config)
      })(pool => IO.blocking(pool.close()))
      .map(new DatabaseSession(_))
