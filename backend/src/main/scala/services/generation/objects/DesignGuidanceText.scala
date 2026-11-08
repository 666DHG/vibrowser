package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class DesignGuidanceText(
    version: String,
    design: String,
    review: String,
    intent: Option[String] = None,
    visualContext: Boolean = false
)
object DesignGuidanceText:
  given Encoder[DesignGuidanceText] = deriveEncoder
  given Decoder[DesignGuidanceText] = deriveDecoder[DesignGuidanceText].prepare(
    _.withFocus(json =>
      if json.hcursor.downField("visualContext").succeeded then json
      else json.mapObject(_.add("visualContext", io.circe.Json.False))
    )
  )
