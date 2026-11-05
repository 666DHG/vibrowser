package services.generation
import cats.effect.{IO, Resource}
import cats.syntax.all.*
import org.http4s.client.Client
import services.system.DatabaseSession
import services.generation.utils.*
object GenerationModule:
  def resource(database: DatabaseSession, client: Client[IO], mock: Boolean): Resource[IO, Unit] =
    val provider: TextGenerationClient =
      if mock then new MockTextGenerationClient else new DeepSeekCompatibleClient(client)
    Resource
      .make(
        new GenerationWorker(
          database,
          provider,
          mock,
          webDocuments = !sys.env.get("VIBROWSER_LEGACY_MOCK").contains("true"),
          researchClient =
            Some(if mock then new MockResearchClient else new DeepSeekResearchClient(client))
        ).run.start
      )(_.cancel)
      .void
