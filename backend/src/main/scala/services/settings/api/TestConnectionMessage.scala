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

import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.generation.objects.{JobKind, JobId}
final case class TestConnectionMessage() extends NoRequestMessage[ConnectionTestResponse]:
  override def plan(connection: Connection): IO[ConnectionTestResponse] =
    for
      config <- SettingsTable.get(connection)
      _ <- IO.raiseUnless(config.hasKey)(AppError("key_required", "请先保存 API Key"))
      id <- IO(JobId(java.util.UUID.randomUUID().toString))
      _ <- GenerationJobTable.insertQueued(
        connection,
        id,
        None,
        JobKind.Connection,
        config.revision
      )
    yield ConnectionTestResponse(id)
object TestConnectionMessage:
  given Decoder[TestConnectionMessage] = deriveDecoder
