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

final case class SaveResearchSettingsMessage(reuseGenerationKey: Boolean, apiKey: Option[String])
    extends APIMessage[ResearchSettings]:
  override def plan(c: Connection): IO[ResearchSettings] =
    for
      config <- ResearchSettingsTable.get(c)
      _ <- IO.raiseWhen(reuseGenerationKey && !config.canReuseGenerationKey)(
        AppError("search_key_required", "请配置 DeepSeek 官方检索密钥")
      )
      _ <- IO.raiseWhen(
        apiKey.exists(k => k.trim.isEmpty || k.length > 4096 || k.exists(_.isControl))
      )(AppError("invalid_key", "密钥格式无效"))
      encrypted <- apiKey.fold(IO.pure(Option.empty[Array[Byte]]))(k =>
        CredentialProtection.encrypt(k.trim).map(Some(_))
      )
      _ <- ResearchSettingsTable.save(c, reuseGenerationKey, encrypted)
      result <- ResearchSettingsTable.get(c)
    yield result
object SaveResearchSettingsMessage:
  given Decoder[SaveResearchSettingsMessage] = deriveDecoder
