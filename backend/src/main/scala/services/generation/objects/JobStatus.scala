package services.generation.objects
import io.circe.{Encoder, Decoder}
enum JobStatus:
  case Queued, Running, Waiting, Succeeded, Failed
object JobStatus:
  def toString(value: JobStatus): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, JobStatus] =
    values.find(v => toString(v) == value).toRight("Unsupported JobStatus")
  given Encoder[JobStatus] = Encoder.encodeString.contramap(toString)
  given Decoder[JobStatus] = Decoder.decodeString.emap(fromString)
