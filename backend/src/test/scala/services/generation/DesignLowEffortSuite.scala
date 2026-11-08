package services.generation
import munit.FunSuite
import io.circe.Json
import io.circe.syntax.*

class DesignLowEffortSuite extends FunSuite:
  test("low experiment changes only official disabled thinking and effort") {
    val original = Json.obj(
      "thinking" -> Json.obj("type" -> "disabled".asJson),
      "messages" -> List(
        Json.obj("role" -> "system".asJson, "content" -> "unchanged".asJson)
      ).asJson,
      "max_tokens" -> 24000.asJson,
      "response_format" -> Json.obj("type" -> "json_object".asJson)
    )
    val result = DesignLowEffortExperiment.payload(original, true, true)
    assertEquals(result.hcursor.downField("thinking").get[String]("type"), Right("enabled"))
    assertEquals(result.hcursor.get[String]("reasoning_effort"), Right("low"))
    def rest(value: Json) = value.mapObject(_.remove("thinking").remove("reasoning_effort"))
    assertEquals(rest(result), rest(original))
    assertEquals(DesignLowEffortExperiment.payload(original, false, true), original)
    assertEquals(DesignLowEffortExperiment.payload(original, true, false), original)
    val deep = result.deepMerge(Json.obj("reasoning_effort" -> "high".asJson))
    assertEquals(DesignLowEffortExperiment.payload(deep, true, true), deep)
  }
