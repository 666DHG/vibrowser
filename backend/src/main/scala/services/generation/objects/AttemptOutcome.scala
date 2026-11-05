package services.generation.objects
import io.circe.{Encoder, Decoder}
enum AttemptOutcome:
  case Accepted, InvalidContent, ProviderFailure
object AttemptOutcome:
  given Encoder[AttemptOutcome] = Encoder.encodeString.contramap(_.toString)
  given Decoder[AttemptOutcome] = Decoder.decodeString.emap(s =>
    values.find(_.toString == s).toRight("Unknown AttemptOutcome: " + s)
  )
