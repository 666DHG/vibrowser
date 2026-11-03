package services.generation.objects
import io.circe.{Encoder, Decoder}
import scala.util.Try
final case class JobId(value: String)
object JobId:
  given Encoder[JobId] = Encoder.encodeString.contramap(_.value)
  given Decoder[JobId] = Decoder.decodeString.emap(s =>
    Try(java.util.UUID.fromString(s)).toEither.left.map(_ => "Invalid JobId").map(_ => JobId(s))
  )
