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

final case class GetProviderConnectionMessage(expectedRevision: Long) extends APIMessage[ProviderConnection]:
  override def plan(connection: Connection): IO[ProviderConnection] =
    for
      config <- SettingsTable.get(connection)
      _ <- IO.raiseWhen(config.revision != expectedRevision)(AppError("settings_changed","设置已变化，请重新提交"))
      encrypted <- CredentialsTable.get(connection).flatMap(IO.fromOption(_)(AppError("key_required","请在设置中保存 API Key")))
      key <- CredentialProtection.decrypt(encrypted)
    yield new ProviderConnection(config.baseUrl,config.model,key,config.revision)
object GetProviderConnectionMessage:
  given Decoder[GetProviderConnectionMessage] = deriveDecoder
