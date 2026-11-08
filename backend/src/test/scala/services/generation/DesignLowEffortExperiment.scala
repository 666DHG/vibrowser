package services.generation
import io.circe.Json
import io.circe.syntax.*

/** Isolated acceptance policy; product Standard remains unchanged until verified. */
private[generation] object DesignLowEffortExperiment:
  def payload(
      original: Json,
      official: Boolean,
      enabled: Boolean,
      outputBudget: Option[Int] = None
  ): Json =
    require(outputBudget.forall(Set(24000, 48000)), "Unsupported capacity experiment")
    val standard = original.hcursor.downField("thinking").get[String]("type").contains("disabled")
    if enabled && official && standard then
      original
        .deepMerge(
          Json.obj(
            "thinking" -> Json.obj("type" -> "enabled".asJson),
            "reasoning_effort" -> "low".asJson
          )
        )
        .deepMerge(outputBudget.fold(Json.obj())(budget => Json.obj("max_tokens" -> budget.asJson)))
    else original
