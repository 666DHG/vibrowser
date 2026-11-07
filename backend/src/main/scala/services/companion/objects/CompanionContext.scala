package services.companion.objects
import io.circe.{Encoder, Decoder}
import services.browser.objects.BrowsingMode
import io.circe.generic.semiauto.*
final case class CompanionContext(
    event: CompanionEvent,
    input: String,
    title: String,
    mode: BrowsingMode
)
object CompanionContext:
  given Encoder[CompanionContext] = deriveEncoder
  given Decoder[CompanionContext] = deriveDecoder
