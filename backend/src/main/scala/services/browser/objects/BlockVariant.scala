package services.browser.objects
import io.circe.{Encoder, Decoder}
enum BlockVariant:
  case Plain, Feature, Outline, Muted
object BlockVariant:
  def toString(value: BlockVariant): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, BlockVariant] =
    values.find(v => toString(v) == value).toRight("Unsupported BlockVariant")
  given Encoder[BlockVariant] = Encoder.encodeString.contramap(toString)
  given Decoder[BlockVariant] = Decoder.decodeString.emap(fromString)
