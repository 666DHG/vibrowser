package services.browser.objects
import io.circe.{Encoder, Decoder}
enum Theme:
  case Paper, Midnight, Terminal, Coral, White, Graphite, Sage
object Theme:
  def toString(value: Theme): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, Theme] =
    values.find(v => toString(v) == value).toRight("Unsupported Theme")
  given Encoder[Theme] = Encoder.encodeString.contramap(toString)
  given Decoder[Theme] = Decoder.decodeString.emap(fromString)
