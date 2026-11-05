package services.settings.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.{APIMessage, NoRequestMessage}
import services.system.objects.AppError
import services.settings.objects.*
import services.settings.tables.ResearchSettingsTable.ResearchSettingsTable
import services.settings.utils.CredentialProtection

final case class GetResearchConnectionMessage(expectedRevision: Option[Long] = None)
    extends APIMessage[ProviderConnection]:
  override def plan(c: Connection): IO[ProviderConnection] =
    for
      config <- ResearchSettingsTable.get(c)
      _ <- IO.raiseWhen(expectedRevision.exists(_ != config.revision))(
        AppError("settings_changed", "检索设置已变化，请重新测试")
      )
      _ <- IO.raiseUnless(config.hasKey)(AppError("search_key_required", "请在设置中配置联网搜索"))
      encrypted <- (if config.reuseGenerationKey then
                      services.settings.tables.CredentialsTable.CredentialsTable.get(c)
                    else ResearchSettingsTable.encrypted(c))
        .flatMap(IO.fromOption(_)(AppError("search_key_required", "请配置联网搜索")))
      key <- CredentialProtection.decrypt(encrypted)
    yield new ProviderConnection("https://api.deepseek.com", "search", key, config.revision)
object GetResearchConnectionMessage:
  given Decoder[GetResearchConnectionMessage] = deriveDecoder
