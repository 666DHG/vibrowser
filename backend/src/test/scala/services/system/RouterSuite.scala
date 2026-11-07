package services.system
import munit.CatsEffectSuite
import cats.effect.IO
import cats.syntax.all.*
import org.http4s.*
import org.http4s.implicits.*
import org.typelevel.ci.CIString
import services.system.routes.APIMessageRouter
import services.settings.routes.SettingsRoutes
class RouterSuite extends CatsEffectSuite:
  test("settings reject foreign origins and non-JSON cross-site requests") {
    DatabaseSession
      .resource(
        s"jdbc:postgresql://127.0.0.1:${sys.env.getOrElse("VIBROWSER_DB_PORT", "55432")}/vibrowser?currentSchema=smoke_test",
        "vibrowser",
        ""
      )
      .use { db =>
        val app = APIMessageRouter.routes(SettingsRoutes.apiMessages, db).orNotFound
        val base = Request[IO](Method.POST, uri"/api/getsettings").putHeaders(
          Header
            .Raw(CIString("Host"), s"127.0.0.1:${sys.env.getOrElse("VIBROWSER_API_PORT", "8787")}")
        )
        for
          foreign <- app.run(
            base.putHeaders(Header.Raw(CIString("Origin"), "https://attacker.example"))
          )
          _ = assertEquals(foreign.status, Status.Forbidden)
          form <- app.run(
            base
              .putHeaders(
                Header.Raw(
                  CIString("Origin"),
                  s"http://127.0.0.1:${sys.env.getOrElse("VIBROWSER_UI_PORT", "5173")}"
                )
              )
              .withEntity("{}")
          )
          _ = assertEquals(form.status, Status.UnsupportedMediaType)
        yield ()
      }
  }
