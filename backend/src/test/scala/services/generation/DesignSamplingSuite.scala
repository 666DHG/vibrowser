package services.generation
import munit.FunSuite
import io.circe.Json
import io.circe.syntax.*

class DesignSamplingSuite extends FunSuite:
  private def request(system: String, thinking: String = "disabled") = Json.obj(
    "messages" -> List(Json.obj("role" -> "system".asJson, "content" -> system.asJson)).asJson,
    "thinking" -> Json.obj("type" -> thinking.asJson),
    "response_format" -> Json.obj("type" -> "json_object".asJson),
    "max_tokens" -> 24000.asJson
  )
  private val document = "生成当前地址的 WebDocument v3 JSON，依据所附请求与设计指导实现页面。"
  test("only official non-thinking document requests receive the experimental temperature") {
    val original = request(document)
    val changed = DesignSamplingExperiment.payload(original, true, Some(1.3))
    assertEquals(changed.hcursor.get[Double]("temperature"), Right(1.3))
    assertEquals(changed.mapObject(_.remove("temperature")), original)
    for system <- List("ResearchPlan:", "只返回内容计划", "评审网页", "连接测试") do
      val other = request(system)
      assertEquals(DesignSamplingExperiment.payload(other, true, Some(1.3)), other)
    val deep = request(document, "enabled")
    assertEquals(DesignSamplingExperiment.payload(deep, true, Some(1.3)), deep)
    assertEquals(DesignSamplingExperiment.payload(original, false, Some(1.3)), original)
    assertEquals(DesignSamplingExperiment.payload(original, true, None), original)
  }
  test("invalid experimental values are rejected before a document request") {
    for value <- List(-0.1, 2.1, Double.NaN, Double.PositiveInfinity) do
      intercept[IllegalArgumentException](
        DesignSamplingExperiment.payload(request(document), true, Some(value))
      )
  }
