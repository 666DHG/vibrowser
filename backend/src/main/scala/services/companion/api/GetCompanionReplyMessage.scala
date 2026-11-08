package services.companion.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.system.objects.AppError
import services.companion.objects.CompanionReply
import services.companion.tables.CompanionTaskTable.CompanionTaskTable
final case class GetCompanionReplyMessage(id: String) extends APIMessage[CompanionReply]:
  override def plan(connection: Connection): IO[CompanionReply] =
    CompanionTaskTable
      .get(connection, id)
      .flatMap(IO.fromOption(_)(AppError("reply_expired", "回应已过期", 404)))
object GetCompanionReplyMessage:
  given Decoder[GetCompanionReplyMessage] = deriveDecoder
