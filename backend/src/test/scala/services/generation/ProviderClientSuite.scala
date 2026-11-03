package services.generation
import munit.CatsEffectSuite
import cats.effect.{IO, Ref}
import cats.syntax.all.*
import org.http4s.*
import org.http4s.client.Client
import org.http4s.circe.CirceEntityCodec.*
import io.circe.Json
import scala.concurrent.duration.*
import services.settings.objects.ProviderConnection
import services.system.objects.AppError
import services.generation.utils.DeepSeekCompatibleClient
class ProviderClientSuite extends CatsEffectSuite:
  private val config =
    new ProviderConnection("https://api.deepseek.com", "deepseek-flash", "fake-test-key", 1)
  test("compatible request sends server-side auth, JSON mode and bounded test output") {
    val app = HttpApp[IO] { request =>
      request.as[Json].flatMap { body =>
        IO {
          assertEquals(request.uri.path.renderString, "/chat/completions")
          assertEquals(
            request.headers.headers
              .find(_.name.toString.equalsIgnoreCase("Authorization"))
              .map(_.value),
            Some("Bearer fake-test-key")
          )
          assertEquals(body.hcursor.get[Int]("max_tokens"), Right(128))
          if request.uri.host.exists(_.value == "api.deepseek.com") then
            assertEquals(body.hcursor.downField("thinking").get[String]("type"), Right("disabled"))
          else assert(!body.hcursor.downField("thinking").succeeded)
          assertEquals(
            body.hcursor.downField("response_format").get[String]("type"),
            Right("json_object")
          )
        }.as(
          Response[IO](Status.Ok).withEntity(
            Json.obj(
              "choices" -> Json.arr(
                Json.obj(
                  "finish_reason" -> Json.fromString("stop"),
                  "message" -> Json.obj("content" -> Json.fromString("""{"ok":true}"""))
                )
              )
            )
          )
        )
      }
    }
    List(config, new ProviderConnection("https://custom.example", "model", "fake-test-key", 1))
      .traverse_ { provider =>
        new DeepSeekCompatibleClient(Client.fromHttpApp(app))
          .complete(provider, "json", "test", true)
          .map(s => assertEquals(s, """{"ok":true}"""))
      }
  }
  test("authentication, quota and rate-limit failures have stable redacted errors") {
    List(
      401 -> "provider_auth",
      403 -> "provider_auth",
      402 -> "provider_quota",
      429 -> "provider_rate_limit",
      500 -> "provider_unavailable"
    ).traverse_ { (code, expected) =>
      val client = Client.fromHttpApp(
        HttpApp[IO](_ =>
          IO.pure(
            Response[IO](Status.fromInt(code).toOption.get).withEntity("secret upstream error")
          )
        )
      )
      new DeepSeekCompatibleClient(client).complete(config, "json", "test", false).attempt.map {
        case Left(e: AppError) =>
          assertEquals(e.code, expected); assert(!e.getMessage.contains("secret"))
        case _ => fail("Expected a stable error")
      }
    }
  }
  test("blank and truncated responses are rejected") {
    List(("", "stop"), ("{}", "length")).traverse_ { (content, finish) =>
      val body = Json.obj(
        "choices" -> Json.arr(
          Json.obj(
            "finish_reason" -> Json.fromString(finish),
            "message" -> Json.obj("content" -> Json.fromString(content))
          )
        )
      )
      val client =
        Client.fromHttpApp(HttpApp[IO](_ => IO.pure(Response[IO](Status.Ok).withEntity(body))))
      new DeepSeekCompatibleClient(client)
        .complete(config, "json", "test", false)
        .attempt
        .map(r => assert(r.isLeft))
    }
  }
  test("timeout is bounded and cancels the response resource") {
    for
      released <- Ref.of[IO, Boolean](false)
      client = Client[IO](_ =>
        cats.effect.Resource
          .make(IO.unit)(_ => released.set(true))
          .flatMap(_ => cats.effect.Resource.eval(IO.never[Response[IO]]))
      )
      result <- new DeepSeekCompatibleClient(client, 30.millis)
        .complete(config, "json", "test", false)
        .attempt
      closed <- released.get
      _ = assertEquals(
        result.left.toOption.collect { case e: AppError => e.code },
        Some("provider_timeout")
      )
      _ = assert(closed)
    yield ()
  }
