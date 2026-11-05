package services.generation.objects
import io.circe.{Encoder, Decoder}
enum DesignSelection:
  case Original, Improved
object DesignSelection:
  given Encoder[DesignSelection] = Encoder.encodeString.contramap(_.toString)
  given Decoder[DesignSelection] =
    Decoder.decodeString.emap(s => values.find(_.toString == s).toRight("Unknown DesignSelection"))
