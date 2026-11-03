package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class GenerationJob(id: String, pageId: Option[String], kind: JobKind, status: JobStatus, phase: String, error: Option[String], settingsRevision: Long)
object GenerationJob:
  given Encoder[GenerationJob] = deriveEncoder
  given Decoder[GenerationJob] = deriveDecoder
