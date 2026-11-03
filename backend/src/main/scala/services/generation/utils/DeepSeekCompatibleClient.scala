package services.generation.utils
import cats.effect.IO
import org.http4s.*
import org.http4s.client.Client
import org.http4s.circe.CirceEntityCodec.*
import org.typelevel.ci.CIString
import io.circe.Json
import io.circe.syntax.*
import scala.concurrent.duration.*
import services.settings.objects.ProviderConnection
import services.system.objects.AppError
private[generation] final class DeepSeekCompatibleClient(
    client: Client[IO],
    requestTimeout: FiniteDuration = 60.seconds
) extends TextGenerationClient:
  def complete(
      config: ProviderConnection,
      system: String,
      prompt: String,
      test: Boolean
  ): IO[String] =
    val payload = Json.obj(
      "model" -> config.model.asJson,
      "messages" -> List(
        Json.obj("role" -> "system".asJson, "content" -> system.asJson),
        Json.obj("role" -> "user".asJson, "content" -> prompt.asJson)
      ).asJson,
      "stream" -> false.asJson,
      "max_tokens" -> (if test then 128 else 12000).asJson,
      "response_format" -> Json.obj("type" -> "json_object".asJson)
    )
    val requestPayload =
      if java.net.URI.create(config.baseUrl).getHost.equalsIgnoreCase("api.deepseek.com") then
        payload.deepMerge(Json.obj("thinking" -> Json.obj("type" -> "disabled".asJson)))
      else payload
    val request = Request[IO](
      Method.POST,
      Uri.unsafeFromString(config.baseUrl.stripSuffix("/") + "/chat/completions")
    )
      .withEntity(requestPayload)
      .putHeaders(Header.Raw(CIString("Authorization"), "Bearer " + config.key))
    client
      .run(request)
      .use { response =>
        val code = response.status.code
        if code == 401 || code == 403 then
          IO.raiseError(AppError("provider_auth", "密钥无效或没有模型权限", 502))
        else if code == 402 then IO.raiseError(AppError("provider_quota", "接口额度不足", 502))
        else if code == 429 then IO.raiseError(AppError("provider_rate_limit", "接口请求受限，请稍后重试", 502))
        else if !response.status.isSuccess then
          IO.raiseError(AppError("provider_unavailable", s"模型接口返回 HTTP $code", 502))
        else
          response.body.take(262145).compile.toVector.flatMap { bytes =>
            if bytes.size > 262144 then IO.raiseError(AppError("provider_size", "模型响应过大", 502))
            else
              IO.fromEither(
                io.circe.parser
                  .parse(new String(bytes.toArray, java.nio.charset.StandardCharsets.UTF_8))
                  .left
                  .map(_ => AppError("provider_format", "模型接口未返回合法 JSON", 502))
              ).flatMap { json =>
                val cursor = json.hcursor.downField("choices").downArray
                val content =
                  cursor.downField("message").get[String]("content").toOption.getOrElse("")
                val truncated = cursor.get[String]("finish_reason").toOption.contains("length")
                if content.trim.isEmpty || truncated then
                  IO.raiseError(AppError("provider_content", "模型输出为空或被截断，请重试", 502))
                else IO.pure(content)
              }
          }
      }
      .timeoutTo(requestTimeout, IO.raiseError(AppError("provider_timeout", "模型响应超时，请重试", 504)))
      .adaptError {
        case e if !e.isInstanceOf[AppError] =>
          AppError("provider_network", "无法连接模型接口，请检查地址或网络", 502)
      }
