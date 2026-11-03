package services.generation.objects
import io.circe.{Encoder, Decoder}
enum GenerationPhase:
  case Queued, Preparing, Generating, Validating, Repairing, Retrying, Saving, Ready, Failed
object GenerationPhase:
  def toString(value: GenerationPhase): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, GenerationPhase] =
    values.find(v => toString(v) == value).toRight("Unsupported GenerationPhase")
  given Encoder[GenerationPhase] = Encoder.encodeString.contramap(toString)
  given Decoder[GenerationPhase] = Decoder.decodeString.emap(fromString)
