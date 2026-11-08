package services.companion.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class CompanionReply(
    id: String,
    status: CompanionStatus,
    text: Option[String],
    expression: CompanionExpression
)
object CompanionReply:
  given Encoder[CompanionReply] = deriveEncoder
  given Decoder[CompanionReply] = deriveDecoder
