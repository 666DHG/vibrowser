package services.generation.utils
import cats.effect.IO
import cats.syntax.all.*
import org.http4s.*
import org.http4s.client.Client
import org.http4s.circe.CirceEntityCodec.*
import org.typelevel.ci.CIString
import io.circe.Json
import io.circe.syntax.*
import scala.concurrent.duration.*
import services.settings.objects.ProviderConnection
import services.browser.objects.ResearchSource
import services.system.objects.AppError
private[generation] final class DeepSeekResearchClient(
    client: Client[IO],
    timeout: FiniteDuration = 20.seconds
) extends ResearchClient:
  private def request(config: ProviderConnection, path: String, payload: Json): IO[Json] =
    client
      .run(
        Request[IO](Method.POST, Uri.unsafeFromString("https://api.deepseek.com/v1/tools/" + path))
          .withEntity(payload)
          .putHeaders(Header.Raw(CIString("Authorization"), "Bearer " + config.key))
      )
      .use { response =>
        val code = response.status.code
        if code == 401 || code == 403 then
          IO.raiseError(AppError("search_auth", "联网搜索密钥无效或没有权限", 502))
        else if code == 402 || code == 429 then
          IO.raiseError(AppError("search_quota", "联网搜索额度不足或请求受限", 502))
        else if !response.status.isSuccess then
          IO.raiseError(AppError("search_unavailable", s"联网搜索返回 HTTP $code", 502))
        else
          response.body.take(1048577).compile.toVector.flatMap { bytes =>
            if bytes.size > 1048576 then IO.raiseError(AppError("search_size", "检索响应过大", 502))
            else
              IO.fromEither(
                io.circe.parser
                  .parse(new String(bytes.toArray, java.nio.charset.StandardCharsets.UTF_8))
                  .left
                  .map(_ => AppError("search_format", "检索接口返回格式错误", 502))
              )
          }
      }
      .timeoutTo(timeout, IO.raiseError(AppError("search_timeout", "联网检索超时，请重试", 504)))
      .adaptError {
        case e if !e.isInstanceOf[AppError] => AppError("search_network", "无法连接联网搜索接口", 502)
      }
  def search(config: ProviderConnection, query: String): IO[List[ResearchSource]] =
    request(
      config,
      "search",
      Json.obj("query" -> query.asJson, "count" -> 6.asJson, "need_content" -> false.asJson)
    ).flatMap { json =>
      IO.fromEither(
        json.hcursor
          .get[List[Json]]("results")
          .left
          .map(_ => AppError("search_format", "搜索结果格式错误", 502))
      ).map(_.flatMap { item =>
        val c = item.hcursor
        for
          url <- c.get[String]("url").toOption.filter(ResearchContent.publicUrl)
          title <- c.get[String]("title").toOption
        yield ResearchSource(
          "",
          url,
          title,
          java.time.Instant.now.toString,
          c.get[String]("summary")
            .toOption
            .filter(_.nonEmpty)
            .orElse(c.get[String]("snippet").toOption)
            .getOrElse("")
        )
      })
    }
  def fetch(config: ProviderConnection, url: String): IO[String] =
    IO.raiseUnless(ResearchContent.publicUrl(url))(AppError("invalid_source", "来源地址无效")) *> request(
      config,
      "fetch",
      Json.obj("url" -> url.asJson)
    ).flatMap(j =>
      IO.fromEither(
        j.hcursor.get[String]("content").left.map(_ => AppError("search_format", "网页正文格式错误", 502))
      )
    )
