package services.browser.objects
import io.circe.{Encoder, Decoder}
enum PageStatus:
  case Generating, Ready, Failed
object PageStatus:
  def toString(value: PageStatus): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, PageStatus] =
    values.find(v => toString(v) == value).toRight("Unsupported PageStatus")
  given Encoder[PageStatus] = Encoder.encodeString.contramap(toString)
  given Decoder[PageStatus] = Decoder.decodeString.emap(fromString)
