package services.generation.api
import cats.effect.IO
import java.sql.Connection
import services.system.api.APIMessage
import services.generation.objects.{JobId, DesignWorkflow}
import services.generation.tables.GenerationJobTable.GenerationJobTable
final case class SaveDesignWorkflowMessage(jobId: JobId, workflow: DesignWorkflow)
    extends APIMessage[Unit]:
  override def plan(connection: Connection): IO[Unit] =
    GenerationJobTable.saveDesignWorkflow(connection, jobId, workflow)
