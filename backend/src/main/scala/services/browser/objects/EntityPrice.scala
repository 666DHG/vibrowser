package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class EntityPrice(amount: BigDecimal, currency: String)
object EntityPrice:
  given Encoder[EntityPrice] = deriveEncoder
  given Decoder[EntityPrice] = deriveDecoder
