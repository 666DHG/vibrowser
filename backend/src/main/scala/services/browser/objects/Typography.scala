package services.browser.objects
import io.circe.{Encoder, Decoder}
enum Typography:
  case Sans, Serif, Mono, Display
object Typography:
  def toString(value: Typography): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, Typography] =
    values.find(v => toString(v) == value).toRight("Unsupported Typography")
  given Encoder[Typography] = Encoder.encodeString.contramap(toString)
  given Decoder[Typography] = Decoder.decodeString.emap(fromString)
