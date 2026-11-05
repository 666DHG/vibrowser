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

final case class TestResearchConnectionMessage()
    extends NoRequestMessage[services.settings.objects.apiTypes.ConnectionTestResponse]:
  override def plan(c: Connection): IO[services.settings.objects.apiTypes.ConnectionTestResponse] =
    for
      config <- ResearchSettingsTable.get(c)
      _ <- IO.raiseUnless(config.hasKey)(AppError("search_key_required", "请配置联网搜索"))
      id <- IO(services.generation.objects.JobId(java.util.UUID.randomUUID().toString))
      _ <- services.generation.tables.GenerationJobTable.GenerationJobTable.insertQueued(
        c,
        id,
        None,
        services.generation.objects.JobKind.SearchConnection,
        config.revision
      )
    yield services.settings.objects.apiTypes.ConnectionTestResponse(id)
object TestResearchConnectionMessage:
  given Decoder[TestResearchConnectionMessage] = deriveDecoder
