package services.browser.objects
import io.circe.{Encoder, Decoder}
enum BlockType:
  case Navbar, Hero, Text, Card, Grid, Button, Footer, Results, Ascii
object BlockType:
  def toString(value: BlockType): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, BlockType] =
    values.find(v => toString(v) == value).toRight("Unsupported BlockType")
  given Encoder[BlockType] = Encoder.encodeString.contramap(toString)
  given Decoder[BlockType] = Decoder.decodeString.emap(fromString)
