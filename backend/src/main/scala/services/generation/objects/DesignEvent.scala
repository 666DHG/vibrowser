package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class DesignEvent(
    stage: DesignStage,
    status: DesignStageStatus,
    at: String,
    message: Option[String] = None,
    output: Option[String] = None
)
object DesignEvent:
  given Encoder[DesignEvent] = deriveEncoder
  given Decoder[DesignEvent] = deriveDecoder
