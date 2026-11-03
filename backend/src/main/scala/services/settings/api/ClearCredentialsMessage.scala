package services.settings.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.NoRequestMessage
import services.system.objects.AppError
import services.settings.objects.*
import services.settings.objects.apiTypes.*
import services.settings.tables.SettingsTable.SettingsTable
import services.settings.tables.CredentialsTable.CredentialsTable
import services.settings.utils.*

final case class ClearCredentialsMessage() extends NoRequestMessage[ClearCredentialsResponse]:
  override def plan(connection: Connection): IO[ClearCredentialsResponse] =
    for
      _ <- SettingsTable.lock(connection)
      previous <- SettingsTable.get(connection)
      _ <- CredentialsTable.clear(connection)
      _ <- SettingsTable.save(connection, previous.baseUrl, previous.model)
    yield ClearCredentialsResponse(true)
object ClearCredentialsMessage:
  given Decoder[ClearCredentialsMessage] = deriveDecoder
