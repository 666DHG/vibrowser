package services.browser.objects
import io.circe.{Encoder, Decoder}
enum Accent:
  case Blue, Red, Green, Amber, Violet, Neutral
object Accent:
  def toString(value: Accent): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, Accent] =
    values.find(v => toString(v) == value).toRight("Unsupported Accent")
  given Encoder[Accent] = Encoder.encodeString.contramap(toString)
  given Decoder[Accent] = Decoder.decodeString.emap(fromString)
