package services.system
import cats.effect.{IO, IOApp, Resource}
import com.comcast.ip4s.*
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.ember.client.EmberClientBuilder
import scala.concurrent.duration.*
import services.system.routes.APIMessageRouter
import services.browser.routes.BrowserRoutes
import services.settings.routes.SettingsRoutes
import services.generation.GenerationModule
object Main extends IOApp.Simple:
  def run: IO[Unit] =
    val mock = sys.env.get("VIBROWSER_MOCK").contains("true")
    val apiPort = sys.env.getOrElse("VIBROWSER_API_PORT", "8787").toInt
    val dbPort = sys.env.getOrElse("VIBROWSER_DB_PORT", "55432").toInt
    val schema = if mock then "vibrowser_demo" else "vibrowser_live"
    val resource = for
      database <- DatabaseSession.resource(
        sys.env.getOrElse(
          "VIBROWSER_DB_URL",
          s"jdbc:postgresql://127.0.0.1:$dbPort/vibrowser?currentSchema=$schema"
        ),
        sys.env.getOrElse("VIBROWSER_DB_USER", "vibrowser"),
        sys.env.getOrElse("VIBROWSER_DB_PASSWORD", "")
      )
      _ <- Resource.eval(
        database.transaction(c =>
          SqlExecutor.update(c, s"CREATE SCHEMA IF NOT EXISTS $schema").void
        )
      )
      _ <- Resource.eval(database.transaction(SchemaInitializer.initialize))
      _ <- Resource.eval(database.transaction(SchemaInitializer.recover))
      _ <- Resource.eval(
        if sys.env.get("VIBROWSER_KEEP_TEMPORARY_FOR_TEST").contains("true") then
          cats.effect.IO.unit
        else database.transaction(services.browser.tables.PageTable.PageTable.clearTemporary)
      )
      client <- EmberClientBuilder
        .default[IO]
        .withTimeout(610.seconds)
        .withIdleConnectionTime(620.seconds)
        .build
      _ <- GenerationModule.resource(database, client, mock)
      server <- EmberServerBuilder
        .default[IO]
        .withHost(host"127.0.0.1")
        .withPort(
          Port.fromInt(apiPort).getOrElse(throw new IllegalArgumentException("Invalid API port"))
        )
        .withHttpApp(
          APIMessageRouter
            .routes(
              BrowserRoutes.apiMessages ++ SettingsRoutes.apiMessages,
              database
            )
            .orNotFound
        )
        .build
      _ <- Resource.eval(IO.println(s"Vibrowser API: http://127.0.0.1:$apiPort | mode=${
          if mock then "MOCK (not real AI)" else "DeepSeek / configured provider"
        }"))
    yield server
    resource.use(_ => IO.never)
