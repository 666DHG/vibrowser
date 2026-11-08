package services.generation
import munit.FunSuite
import io.circe.syntax.*
import io.circe.parser.decode
import services.generation.objects.*
import services.generation.utils.DesignDirections

class DesignDirectionsSuite extends FunSuite:
  private val choices =
    List("a", "b", "c").map(n => DesignDirection(n, n + "-structure", n + "-type", n + "-reason"))
  test(
    "address-based selection uses supplied ideas, is stable, and tolerates absent optional ideas"
  ) {
    val selected =
      (1 to 30).map(i => DesignDirections.select(s"https://site$i.example/", choices).get).toSet
    assertEquals(selected, choices.toSet)
    assertEquals(DesignDirections.select("same", choices), DesignDirections.select("same", choices))
    assertEquals(DesignDirections.select("any", Nil), None)
    assertEquals(DesignDirections.select("any", List(choices.head.copy(structure = ""))), None)
    assertEquals(
      DesignDirections.select("any", List(choices.head.copy(typography = "x" * 1201))),
      None
    )
    assertEquals(DesignDirections.select("any", List.fill(3)(choices.head)), Some(choices.head))
  }
  test("new compact plans and old workflow snapshots remain readable") {
    val compact = io.circe.Json.obj(
      "purpose" -> "阅读".asJson,
      "visitorTask" -> "找文章".asJson,
      "contentPriorities" -> List("正文").asJson,
      "visualDirections" -> choices.asJson
    )
    val brief = compact.as[DesignBrief].toOption.get
    assertEquals(brief.visualDirections, choices)
    assertEquals(brief.informationStructure, "")
    assertEquals(brief.asJson.as[DesignBrief], Right(brief))
    val old = DesignWorkflow("old").asJson.mapObject(
      _.remove("layoutExploration").remove("designDirection")
    )
    assertEquals(old.as[DesignWorkflow].toOption.get.designDirection, None)
    assertEquals(old.as[DesignWorkflow].toOption.get.layoutExploration, None)
    assertEquals(
      decode[DesignGuidanceText](
        """{"version":"old","design":"d","review":"r"}"""
      ).toOption.get.exploreLayouts,
      false
    )
  }
