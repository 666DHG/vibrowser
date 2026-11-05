package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class DesignIssue(target: String, observation: String, impact: String, change: String)
object DesignIssue:
  given Encoder[DesignIssue] = deriveEncoder
  given Decoder[DesignIssue] = deriveDecoder
