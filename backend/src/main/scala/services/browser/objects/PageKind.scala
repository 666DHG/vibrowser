package services.browser.objects
import io.circe.{Encoder, Decoder}
enum PageKind:
  case Website, Search
object PageKind:
  def toString(value: PageKind): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, PageKind] =
    values.find(v => toString(v) == value).toRight("Unsupported PageKind")
  given Encoder[PageKind] = Encoder.encodeString.contramap(toString)
  given Decoder[PageKind] = Decoder.decodeString.emap(fromString)
