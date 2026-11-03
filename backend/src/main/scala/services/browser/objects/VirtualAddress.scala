package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class VirtualAddress(canonical: String, kind: PageKind, prompt: String)
object VirtualAddress:
  given Encoder[VirtualAddress] = deriveEncoder
  given Decoder[VirtualAddress] = deriveDecoder
