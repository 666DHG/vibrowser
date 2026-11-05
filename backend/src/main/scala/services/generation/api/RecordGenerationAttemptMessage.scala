package services.generation.api
import cats.effect.IO
import java.sql.Connection
import services.system.api.APIMessage
import services.generation.objects.{JobId, GenerationAttempt}
import services.generation.tables.GenerationJobTable.GenerationJobTable
final case class RecordGenerationAttemptMessage(jobId: JobId, record: GenerationAttempt)
    extends APIMessage[Unit]:
  override def plan(connection: Connection): IO[Unit] =
    GenerationJobTable.recordAttempt(connection, jobId, record)
