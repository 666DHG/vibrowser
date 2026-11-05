package services.generation.objects
import io.circe.{Encoder, Decoder}
enum DesignStage:
  case Brief, MeasureOriginal, Review, Improve, MeasureImproved, Selection
object DesignStage:
  given Encoder[DesignStage] = Encoder.encodeString.contramap(_.toString)
  given Decoder[DesignStage] =
    Decoder.decodeString.emap(s => values.find(_.toString == s).toRight("Unknown DesignStage"))
