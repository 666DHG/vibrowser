package services.browser.objects.apiTypes
import services.browser.objects.*
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class NavigationResponse(pageId: String, jobId: String, status: PageStatus)
object NavigationResponse:
  given Encoder[NavigationResponse] = deriveEncoder
  given Decoder[NavigationResponse] = deriveDecoder
