package services.generation.objects
import services.browser.objects.PageId
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class GenerationJob(
    id: JobId,
    pageId: Option[PageId],
    kind: JobKind,
    status: JobStatus,
    phase: String,
    error: Option[String],
    settingsRevision: Long
)
object GenerationJob:
  given Encoder[GenerationJob] = deriveEncoder
  given Decoder[GenerationJob] = deriveDecoder
