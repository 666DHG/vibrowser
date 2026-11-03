package services.browser.objects
import io.circe.{Encoder, Decoder}
import scala.util.Try
final case class PageId(value: String)
object PageId:
  given Encoder[PageId] = Encoder.encodeString.contramap(_.value)
  given Decoder[PageId] = Decoder.decodeString.emap(s =>
    Try(java.util.UUID.fromString(s)).toEither.left.map(_ => "Invalid PageId").map(_ => PageId(s))
  )
