package services.browser.objects
import io.circe.{Encoder, Decoder}
enum Density:
  case Compact, Comfortable, Airy
object Density:
  def toString(value: Density): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, Density] =
    values.find(v => toString(v) == value).toRight("Unsupported Density")
  given Encoder[Density] = Encoder.encodeString.contramap(toString)
  given Decoder[Density] = Decoder.decodeString.emap(fromString)
