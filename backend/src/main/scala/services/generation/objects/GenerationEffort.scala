package services.generation.objects
import io.circe.{Decoder, Encoder}

enum GenerationEffort:
  case Standard, Deep
object GenerationEffort:
  def toString(value: GenerationEffort): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, GenerationEffort] =
    values.find(v => toString(v) == value).toRight("Unsupported generation effort")
  given Encoder[GenerationEffort] = Encoder.encodeString.contramap(toString)
  given Decoder[GenerationEffort] = Decoder.decodeString.emap(fromString)
