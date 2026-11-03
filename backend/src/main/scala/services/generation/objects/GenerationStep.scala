package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class GenerationStep(phase: GenerationPhase, attempt: Int, at: String)
object GenerationStep:
  given Encoder[GenerationStep] = deriveEncoder
  given Decoder[GenerationStep] = deriveDecoder
