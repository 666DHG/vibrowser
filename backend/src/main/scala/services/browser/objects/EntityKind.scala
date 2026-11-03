package services.browser.objects
import io.circe.{Encoder, Decoder}

enum EntityKind:
  case Thread, Article, Product, Page
object EntityKind:
  def toString(value: EntityKind): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, EntityKind] =
    values.find(v => toString(v) == value).toRight("Unsupported EntityKind")
  given Encoder[EntityKind] = Encoder.encodeString.contramap(toString)
  given Decoder[EntityKind] = Decoder.decodeString.emap(fromString)
