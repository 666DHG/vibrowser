package services.browser.objects
import io.circe.{Encoder, Decoder}
enum BlockPlacement:
  case Auto, Main, Aside, Full
object BlockPlacement:
  def toString(value: BlockPlacement): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, BlockPlacement] =
    values.find(v => toString(v) == value).toRight("Unsupported BlockPlacement")
  given Encoder[BlockPlacement] = Encoder.encodeString.contramap(toString)
  given Decoder[BlockPlacement] = Decoder.decodeString.emap(fromString)
