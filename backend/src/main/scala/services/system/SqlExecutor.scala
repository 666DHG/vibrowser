package services.system
import cats.effect.{IO, Resource}
import java.sql.{Connection, PreparedStatement, ResultSet}
// Shared JDBC mechanics only. Business SQL and row mappings remain private in each Table.
object SqlExecutor:
  private def statement(
      c: Connection,
      sql: String,
      args: List[Any]
  ): Resource[IO, PreparedStatement] =
    Resource
      .make(IO.blocking {
        val s = c.prepareStatement(sql)
        s
      })(s => IO.blocking(s.close()))
      .evalTap(s =>
        IO.blocking(args.zipWithIndex.foreach { case (value, index) =>
          s.setObject(index + 1, value)
        })
      )
  def update(c: Connection, sql: String, args: List[Any] = Nil): IO[Int] =
    statement(c, sql, args).use(s => IO.blocking(s.executeUpdate()))
  def query[A](c: Connection, sql: String, args: List[Any] = Nil)(
      read: ResultSet => A
  ): IO[List[A]] =
    statement(c, sql, args).use { s =>
      Resource.make(IO.blocking(s.executeQuery()))(r => IO.blocking(r.close())).use { r =>
        def collect: IO[List[A]] =
          IO.blocking(r.next()).flatMap {
            case false => IO.pure(Nil)
            case true  => IO.blocking(read(r)).flatMap(a => IO.defer(collect).map(a :: _))
          }
        collect
      }
    }
