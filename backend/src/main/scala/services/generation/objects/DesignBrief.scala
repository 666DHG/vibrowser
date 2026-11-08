package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class DesignBrief(
    purpose: String,
    visitorTask: String,
    contentPriorities: List[String],
    informationStructure: String,
    typography: String,
    interactions: List[String],
    continuity: String,
    rationale: String,
    visualDirections: List[DesignDirection] = Nil
)
object DesignBrief:
  given Encoder[DesignBrief] = deriveEncoder
  given Decoder[DesignBrief] = Decoder.instance { c =>
    for
      purpose <- c.get[String]("purpose")
      task <- c.get[String]("visitorTask")
      priorities <- c.get[List[String]]("contentPriorities")
      structure <- c.get[Option[String]]("informationStructure")
      typography <- c.get[Option[String]]("typography")
      interactions <- c.get[Option[List[String]]]("interactions")
      continuity <- c.get[Option[String]]("continuity")
      rationale <- c.get[Option[String]]("rationale")
      directions <- c.get[Option[List[DesignDirection]]]("visualDirections")
    yield DesignBrief(
      purpose,
      task,
      priorities,
      structure.getOrElse(""),
      typography.getOrElse(""),
      interactions.getOrElse(Nil),
      continuity.getOrElse(""),
      rationale.getOrElse(""),
      directions.getOrElse(Nil)
    )
  }
