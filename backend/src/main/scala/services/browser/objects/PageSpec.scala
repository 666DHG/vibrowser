package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class PageSpec(
    schemaVersion: Int,
    title: String,
    description: String,
    theme: Theme,
    blocks: List[PageBlock],
    design: Option[PageDesign] = None,
    entities: List[PageEntity] = Nil,
    subjectEntityId: Option[String] = None
)
object PageSpec:
  given Encoder[PageSpec] = deriveEncoder
  given Decoder[PageSpec] = deriveDecoder[PageSpec].prepare(
    _.withFocus(
      _.mapObject(fields =>
        if fields.contains("entities") then fields else fields.add("entities", io.circe.Json.arr())
      )
    )
  )
