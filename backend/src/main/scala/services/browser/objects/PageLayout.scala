package services.browser.objects
import io.circe.{Encoder, Decoder}
enum PageLayout:
  case Classic, Editorial, Storefront, Documentation, Community, Dashboard, Studio, Directory
object PageLayout:
  def toString(value: PageLayout): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, PageLayout] =
    values.find(v => toString(v) == value).toRight("Unsupported PageLayout")
  given Encoder[PageLayout] = Encoder.encodeString.contramap(toString)
  given Decoder[PageLayout] = Decoder.decodeString.emap(fromString)
