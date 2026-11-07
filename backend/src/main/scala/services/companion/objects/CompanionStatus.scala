package services.companion.objects
import io.circe.{Encoder, Decoder}
enum CompanionStatus:
  case Queued, Running, Complete, Failed
object CompanionStatus:
  def toString(value: CompanionStatus): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, CompanionStatus] =
    values.find(v => toString(v) == value).toRight("Unsupported CompanionStatus")
  given Encoder[CompanionStatus] = Encoder.encodeString.contramap(toString)
  given Decoder[CompanionStatus] = Decoder.decodeString.emap(fromString)
