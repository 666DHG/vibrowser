package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class PageRecord(id: String, address: String, kind: PageKind, prompt: String, status: PageStatus, spec: Option[PageSpec], currentJobId: String, referrerId: Option[String], error: Option[String], source: String)
object PageRecord:
  given Encoder[PageRecord] = deriveEncoder
  given Decoder[PageRecord] = deriveDecoder
