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

final case class GetResearchSettingsMessage() extends NoRequestMessage[ResearchSettings]:
  override def plan(c: Connection): IO[ResearchSettings] =
    ResearchSettingsTable.get(c)
object GetResearchSettingsMessage:
  given Decoder[GetResearchSettingsMessage] = deriveDecoder
