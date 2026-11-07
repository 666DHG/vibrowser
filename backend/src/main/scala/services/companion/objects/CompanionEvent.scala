package services.companion.objects
import io.circe.{Encoder, Decoder}
enum CompanionEvent:
  case Navigate, Success, Click, Bookmark
object CompanionEvent:
  def toString(value: CompanionEvent): String = value.toString.toLowerCase(java.util.Locale.ROOT)
  def fromString(value: String): Either[String, CompanionEvent] =
    values.find(v => toString(v) == value).toRight("Unsupported CompanionEvent")
  given Encoder[CompanionEvent] = Encoder.encodeString.contramap(toString)
  given Decoder[CompanionEvent] = Decoder.decodeString.emap(fromString)
