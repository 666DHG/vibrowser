package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
import services.browser.objects.PageKind

final case class GenerationTarget(
    address: String,
    input: String,
    kind: PageKind,
    readableAddress: String,
    host: Option[String],
    path: Option[String],
    query: Option[String]
)
object GenerationTarget:
  given Encoder[GenerationTarget] = deriveEncoder
  given Decoder[GenerationTarget] = deriveDecoder
