package services.system.objects
import cats.effect.IO
import io.circe.{Decoder, Encoder, Json}
import io.circe.syntax.*
import java.sql.Connection
import scala.reflect.ClassTag
import services.system.api.APIMessage
final case class RegisteredAPIMessage(name: String, run: (Json, Connection) => IO[Json])
object RegisteredAPIMessage:
  def apply[M <: APIMessage[R]: Decoder: ClassTag, R: Encoder]: RegisteredAPIMessage =
    val name = summon[ClassTag[M]].runtimeClass.getSimpleName.stripSuffix("Message").toLowerCase(java.util.Locale.ROOT)
    RegisteredAPIMessage(name, (json, c) =>
      IO.fromEither(json.as[M].left.map(_ => AppError("invalid_request", "请求格式不正确"))).flatMap(_.plan(c)).map(_.asJson))
