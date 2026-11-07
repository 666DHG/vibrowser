package services.generation.objects
import io.circe.{Decoder, Encoder}

enum DesignIssueCategory:
  case Interaction, Readability, Layout, Content
object DesignIssueCategory:
  given Encoder[DesignIssueCategory] = Encoder.encodeString.contramap(_.toString)
  given Decoder[DesignIssueCategory] = Decoder.decodeString.emap(s =>
    values.find(_.toString == s).toRight("Unknown DesignIssueCategory: " + s)
  )
