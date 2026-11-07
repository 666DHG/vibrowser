package services.companion.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class CompanionTask(id: String, context: CompanionContext, revision: Long)
object CompanionTask:
  given Encoder[CompanionTask] = deriveEncoder
  given Decoder[CompanionTask] = deriveDecoder
