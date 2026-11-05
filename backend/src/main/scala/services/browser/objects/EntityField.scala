package services.browser.objects
import io.circe.{Encoder, Decoder}
enum EntityField:
  case Title, Summary, Author, PublishedAt, ReplyCount, Price, LegacyMeta
object EntityField:
  given Encoder[EntityField] = Encoder.encodeString.contramap(_.toString)
  given Decoder[EntityField] = Decoder.decodeString.emap(s =>
    values.find(_.toString == s).toRight("Unknown EntityField: " + s)
  )
