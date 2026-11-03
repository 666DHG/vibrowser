package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class PageSpec(schemaVersion: Int, title: String, description: String, theme: Theme, blocks: List[PageBlock])
object PageSpec:
  given Encoder[PageSpec] = deriveEncoder
  given Decoder[PageSpec] = deriveDecoder
