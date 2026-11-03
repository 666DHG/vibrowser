package services.browser.objects.apiTypes
import services.browser.objects.*
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
import services.generation.objects.GenerationJob
final case class PageResponse(page: Option[PageRecord], job: Option[GenerationJob])
object PageResponse:
  given Encoder[PageResponse] = deriveEncoder
  given Decoder[PageResponse] = deriveDecoder
