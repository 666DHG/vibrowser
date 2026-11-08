package services.companion.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.system.objects.AppError
import services.settings.api.GetSettingsMessage
import services.companion.objects.*
import services.companion.tables.CompanionTaskTable.CompanionTaskTable
import services.companion.utils.CompanionRules
final case class RequestCompanionReplyMessage(context: CompanionContext)
    extends APIMessage[CompanionReply]:
  override def plan(connection: Connection): IO[CompanionReply] =
    for
      _ <- IO.raiseUnless(CompanionRules.valid(context))(AppError("invalid_context", "桌宠事件格式不正确"))
      settings <- GetSettingsMessage().plan(connection)
      _ <- IO.raiseUnless(settings.hasKey || sys.env.get("VIBROWSER_MOCK").contains("true"))(
        AppError("key_required", "请先配置模型")
      )
      id <- IO(java.util.UUID.randomUUID().toString)
      _ <- CompanionTaskTable.enqueue(connection, CompanionTask(id, context, settings.revision))
    yield CompanionReply(id, CompanionStatus.Queued, None, CompanionExpression.Idle)
object RequestCompanionReplyMessage:
  given Decoder[RequestCompanionReplyMessage] = deriveDecoder
