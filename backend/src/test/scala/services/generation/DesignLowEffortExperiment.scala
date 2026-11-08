package services.generation
import io.circe.Json
import io.circe.syntax.*

/** Isolated acceptance policy; product Standard remains unchanged until verified. */
private[generation] object DesignLowEffortExperiment:
  def payload(original: Json, official: Boolean, enabled: Boolean): Json =
    val standard = original.hcursor.downField("thinking").get[String]("type").contains("disabled")
    if enabled && official && standard then
      original.deepMerge(
        Json.obj(
          "thinking" -> Json.obj("type" -> "enabled".asJson),
          "reasoning_effort" -> "low".asJson
        )
      )
    else original
