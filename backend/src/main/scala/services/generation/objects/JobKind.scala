package services.generation.objects
import io.circe.{Encoder, Decoder}
enum JobKind:
  case Page, Connection, Action
object JobKind:
  def toString(value: JobKind): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, JobKind] =
    values.find(v => toString(v) == value).toRight("Unsupported JobKind")
  given Encoder[JobKind] = Encoder.encodeString.contramap(toString)
  given Decoder[JobKind] = Decoder.decodeString.emap(fromString)
