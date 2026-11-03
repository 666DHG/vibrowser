package services.browser.objects.apiTypes
import services.generation.objects.JobId
import services.browser.objects.*
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class NavigationResponse(pageId: PageId, jobId: JobId, status: PageStatus)
object NavigationResponse:
  given Encoder[NavigationResponse] = deriveEncoder
  given Decoder[NavigationResponse] = deriveDecoder
