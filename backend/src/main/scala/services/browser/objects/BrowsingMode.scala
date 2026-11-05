package services.browser.objects
import io.circe.{Encoder, Decoder}
enum BrowsingMode:
  case Imagination, Research
object BrowsingMode:
  def toString(value: BrowsingMode): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, BrowsingMode] =
    values.find(v => toString(v) == value).toRight("Unsupported browsing mode")
  given Encoder[BrowsingMode] = Encoder.encodeString.contramap(toString)
  given Decoder[BrowsingMode] = Decoder.decodeString.emap(fromString)
