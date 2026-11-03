package services.browser.objects
import services.generation.objects.JobId
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class PageRecord(
    id: PageId,
    address: String,
    kind: PageKind,
    prompt: String,
    status: PageStatus,
    spec: Option[PageSpec],
    currentJobId: JobId,
    referrerId: Option[PageId],
    error: Option[String],
    source: String
)
object PageRecord:
  given Encoder[PageRecord] = deriveEncoder
  given Decoder[PageRecord] = deriveDecoder
