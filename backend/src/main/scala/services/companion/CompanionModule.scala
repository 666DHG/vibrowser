package services.companion
import cats.effect.{IO, Resource}
import cats.syntax.all.*
import org.http4s.client.Client
import services.system.DatabaseSession
import services.companion.tables.CompanionTaskTable.CompanionTaskTable
import services.companion.utils.CompanionWorker
// Resource assembly belongs at the module root, like GenerationModule.
object CompanionModule:
  def resource(database: DatabaseSession, client: Client[IO], mock: Boolean): Resource[IO, Unit] =
    Resource.eval(database.transaction(CompanionTaskTable.clear)) *>
      Resource.make(new CompanionWorker(database, client, mock).run.start)(_.cancel).void
