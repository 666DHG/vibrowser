package services.browser.objects
import io.circe.{Encoder, Decoder}
enum WebActionKind:
  case Navigate, Search, Submit, Replace, Append, Toggle, Switch, Filter, Sort, Set, Increment, Copy
object WebActionKind:
  given Encoder[WebActionKind] = Encoder.encodeString.contramap(_.toString)
  given Decoder[WebActionKind] = Decoder.decodeString.emap(s =>
    values.find(_.toString == s).toRight("Unknown WebActionKind: " + s)
  )
