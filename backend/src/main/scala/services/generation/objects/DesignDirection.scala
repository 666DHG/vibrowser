package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class DesignDirection(
    concept: String,
    structure: String,
    typography: String,
    contentReason: String
)
object DesignDirection:
  given Encoder[DesignDirection] = deriveEncoder
  given Decoder[DesignDirection] = deriveDecoder
