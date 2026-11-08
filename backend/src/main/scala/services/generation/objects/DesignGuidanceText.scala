package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class DesignGuidanceText(
    version: String,
    design: String,
    review: String,
    intent: Option[String] = None,
    visualContext: Boolean = false,
    contentFocusOnly: Boolean = false
)
object DesignGuidanceText:
  given Encoder[DesignGuidanceText] = deriveEncoder
  given Decoder[DesignGuidanceText] = deriveDecoder[DesignGuidanceText].prepare(
    _.withFocus(json =>
      List("visualContext", "contentFocusOnly").foldLeft(json)((value, field) =>
        if value.hcursor.downField(field).succeeded then value
        else value.mapObject(_.add(field, io.circe.Json.False))
      )
    )
  )
