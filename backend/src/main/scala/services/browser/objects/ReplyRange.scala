package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class ReplyRange(from: Int, to: Int)
object ReplyRange:
  given Encoder[ReplyRange] = deriveEncoder
  given Decoder[ReplyRange] = deriveDecoder
