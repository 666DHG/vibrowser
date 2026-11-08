package services.generation
import io.circe.Json
import io.circe.syntax.*

/** Paid acceptance only; never changes production defaults or thinking requests. */
private[generation] object DesignSamplingExperiment:
  def payload(original: Json, official: Boolean, temperature: Option[Double]): Json =
    val cursor = original.hcursor
    val system = cursor.downField("messages").downArray.get[String]("content").getOrElse("")
    val standard = cursor.downField("thinking").get[String]("type").contains("disabled")
    if official && standard && system.startsWith("生成当前地址的 WebDocument v3 JSON") then
      temperature.fold(original) { value =>
        require(value >= 0 && value <= 2 && value.isFinite, "Invalid sampling temperature")
        original.deepMerge(Json.obj("temperature" -> value.asJson))
      }
    else original
