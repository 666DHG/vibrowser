package services.companion.objects
import io.circe.{Encoder, Decoder}
enum CompanionExpression:
  case Idle, Happy
object CompanionExpression:
  def toString(value: CompanionExpression): String =
    value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, CompanionExpression] =
    values.find(v => toString(v) == value).toRight("Unsupported CompanionExpression")
  given Encoder[CompanionExpression] = Encoder.encodeString.contramap(toString)
  given Decoder[CompanionExpression] = Decoder.decodeString.emap(fromString)
