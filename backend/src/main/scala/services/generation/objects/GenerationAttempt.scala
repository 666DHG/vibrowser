package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class GenerationAttempt(
    attempt: Int,
    outcome: AttemptOutcome,
    output: Option[String],
    errorCode: Option[String],
    message: Option[String],
    at: String
)
object GenerationAttempt:
  given Encoder[GenerationAttempt] = deriveEncoder
  given Decoder[GenerationAttempt] = deriveDecoder
