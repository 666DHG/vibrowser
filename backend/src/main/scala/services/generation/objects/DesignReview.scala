package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class DesignReview(issues: List[DesignIssue])
object DesignReview:
  given Encoder[DesignReview] = deriveEncoder
  given Decoder[DesignReview] = deriveDecoder
