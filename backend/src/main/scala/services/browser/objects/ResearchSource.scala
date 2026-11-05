package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class ResearchSource(
    id: String,
    url: String,
    title: String,
    retrievedAt: String,
    excerpt: String
)
object ResearchSource:
  given Encoder[ResearchSource] = deriveEncoder
  given Decoder[ResearchSource] = deriveDecoder
