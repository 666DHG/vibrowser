package services.generation
import munit.CatsEffectSuite
import cats.effect.IO
import cats.syntax.all.*
import org.http4s.*
import org.http4s.client.Client
import org.http4s.circe.CirceEntityCodec.*
import io.circe.Json
import scala.concurrent.duration.*
import services.settings.objects.ProviderConnection
import services.system.objects.AppError
import services.generation.utils.*
class ResearchClientSuite extends CatsEffectSuite:
  private val config =
    new ProviderConnection("https://ignored.example", "unused", "fake-search-key", 1)
  test("official search endpoint, auth, valid result and fetch markdown") {
    val app = HttpApp[IO](r =>
      r.as[Json]
        .flatMap(body =>
          IO {
            assertEquals(r.uri.host.map(_.value), Some("api.deepseek.com"))
            assert(
              r.headers.headers.exists(h =>
                h.name.toString == "Authorization" && h.value == "Bearer fake-search-key"
              )
            )
            if r.uri.path.renderString.endsWith("search") then
              assertEquals(body.hcursor.get[Int]("count"), Right(6))
              Response[IO](Status.Ok).withEntity(
                io.circe.parser
                  .parse(
                    """{"results":[{"url":"https://www.tsinghua.edu.cn/","title":"清华大学","summary":"学校资料"}]}"""
                  )
                  .toOption
                  .get
              )
            else
              Response[IO](Status.Ok).withEntity(Json.obj("content" -> Json.fromString("# 学校资料")))
          }
        )
    )
    val client = new DeepSeekResearchClient(Client.fromHttpApp(app))
    for
      results <- client.search(config, "清华大学")
      body <- client.fetch(config, results.head.url)
      _ = assertEquals(results.head.title, "清华大学")
      _ = assertEquals(body, "# 学校资料")
    yield ()
  }
  test("empty search is distinct from auth, quota and network failures") {
    val empty = new DeepSeekResearchClient(
      Client.fromHttpApp(
        HttpApp[IO](_ =>
          IO.pure(Response[IO](Status.Ok).withEntity(Json.obj("results" -> Json.arr())))
        )
      )
    )
    for
      rows <- empty.search(config, "不存在")
      _ = assertEquals(rows, Nil)
      _ <- List(
        401 -> "search_auth",
        403 -> "search_auth",
        402 -> "search_quota",
        429 -> "search_quota",
        500 -> "search_unavailable"
      ).traverse_ { (code, expected) =>
        val client = new DeepSeekResearchClient(
          Client.fromHttpApp(
            HttpApp[IO](_ => IO.pure(Response[IO](Status.fromInt(code).toOption.get)))
          )
        )
        client.search(config, "test").attempt.map { result =>
          assertEquals(result.swap.toOption.get.asInstanceOf[AppError].code, expected)
          assert(!result.swap.toOption.get.getMessage.contains("fake-search-key"))
        }
      }
    yield ()
  }
  test("tool request timeout and whole-paragraph source budget") {
    val client =
      new DeepSeekResearchClient(Client.fromHttpApp(HttpApp[IO](_ => IO.never)), 30.millis)
    client.search(config, "test").attempt.map { result =>
      assertEquals(result.swap.toOption.get.asInstanceOf[AppError].code, "search_timeout")
      assertEquals(ResearchContent.excerpt("a" * 4000 + "\n短段落"), "短段落")
      assert(!ResearchContent.publicUrl("http://127.0.0.1/test"))
    }
  }
