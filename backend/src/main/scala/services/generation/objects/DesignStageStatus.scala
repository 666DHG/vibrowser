package services.generation.objects
import io.circe.{Encoder, Decoder}
enum DesignStageStatus:
  case Started, Completed, Failed, Skipped
object DesignStageStatus:
  given Encoder[DesignStageStatus] = Encoder.encodeString.contramap(_.toString)
  given Decoder[DesignStageStatus] = Decoder.decodeString.emap(s =>
    values.find(_.toString == s).toRight("Unknown DesignStageStatus")
  )
