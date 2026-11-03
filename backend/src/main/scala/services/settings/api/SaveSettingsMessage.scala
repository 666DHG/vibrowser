package services.settings.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.system.objects.AppError
import services.settings.objects.*
import services.settings.objects.apiTypes.*
import services.settings.tables.SettingsTable.SettingsTable
import services.settings.tables.CredentialsTable.CredentialsTable
import services.settings.utils.*

final case class SaveSettingsMessage(baseUrl: String, model: String, apiKey: Option[String]) extends APIMessage[ProviderSettings]:
  override def plan(connection: Connection): IO[ProviderSettings] =
    for
      url <- IO.fromEither(SettingsRules.normalize(baseUrl))
      _ <- IO.raiseWhen(model.trim.isEmpty || model.length > 120)(AppError("invalid_model","请填写模型名称"))
      _ <- IO.raiseWhen(apiKey.exists(k => k.trim.isEmpty || k.length > 4096 || k.exists(_.isControl)))(AppError("invalid_key","密钥为空或格式无效"))
      _ <- SettingsTable.lock(connection)
      previous <- SettingsTable.get(connection)
      _ <- IO.raiseWhen(url != previous.baseUrl && apiKey.isEmpty)(AppError("key_required","切换接口地址时请重新填写密钥"))
      _ <- apiKey.fold(IO.unit)(key => CredentialProtection.encrypt(key.trim).flatMap(CredentialsTable.save(connection,_)))
      _ <- SettingsTable.save(connection,url,model.trim)
      result <- SettingsTable.get(connection)
    yield result
object SaveSettingsMessage:
  given Decoder[SaveSettingsMessage] = deriveDecoder
