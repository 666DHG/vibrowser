package services.system.routes
import cats.effect.IO
import org.http4s.*
import org.http4s.dsl.io.*
import org.http4s.circe.CirceEntityCodec.*
import io.circe.Json
import io.circe.syntax.*
import services.system.DatabaseSession
import services.system.objects.*
object APIMessageRouter:
  def routes(messages: List[RegisteredAPIMessage], database: DatabaseSession): HttpRoutes[IO] =
    val registry = messages.map(m => m.name -> m).toMap
    HttpRoutes.of[IO] {
      case GET -> Root / "health" => Ok(Json.obj("status" -> Json.fromString("ok")))
      case request @ POST -> Root / "api" / name =>
        val allowedOrigins = Set("http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:8787")
        val origin = request.headers.headers.find(_.name.toString.equalsIgnoreCase("Origin")).map(_.value)
        val host = request.headers.headers.find(_.name.toString.equalsIgnoreCase("Host")).map(_.value)
        val allowedHosts = Set("127.0.0.1:8787", "localhost:8787", "127.0.0.1:5173", "localhost:5173")
        val action = for
          _ <- IO.raiseWhen(origin.exists(o => !allowedOrigins(o)) || !host.exists(allowedHosts))(
            AppError("origin_denied", "请求来源不允许", 403))
          _ <- IO.raiseUnless(request.contentType.exists(_.mediaType == MediaType.application.json))(
            AppError("invalid_content_type", "请发送 JSON 请求", 415))
          raw <- request.body.take(131073).compile.toVector
          _ <- IO.raiseWhen(raw.size > 131072)(AppError("request_too_large", "请求过大", 413))
          json <- IO.fromEither(io.circe.parser.parse(new String(raw.toArray, java.nio.charset.StandardCharsets.UTF_8))
            .left.map(_ => AppError("invalid_json", "请求不是合法 JSON")))
          message <- IO.fromOption(registry.get(name))(AppError("not_found", "接口不存在", 404))
          result <- database.transaction(c => message.run(json, c))
          response <- Ok(result)
        yield response
        action.handleErrorWith {
          case e: AppError => IO.pure(Response[IO](Status.fromInt(e.status).getOrElse(Status.BadRequest))
            .withEntity(ErrorResponse(e.code, e.getMessage).asJson))
          case _ => InternalServerError(ErrorResponse("internal_error", "服务暂时不可用，请检查本地服务状态").asJson)
        }
    }
