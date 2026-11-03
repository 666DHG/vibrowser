package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class PageEntity(
    id: String,
    kind: EntityKind,
    title: Option[String],
    summary: Option[String],
    author: Option[String] = None,
    publishedAt: Option[String] = None,
    replyCount: Option[Int] = None,
    price: Option[EntityPrice] = None,
    legacyMeta: Option[String] = None
)
object PageEntity:
  given Encoder[PageEntity] = deriveEncoder
  given Decoder[PageEntity] = deriveDecoder
