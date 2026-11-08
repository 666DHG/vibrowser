package services.generation.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
import services.browser.objects.WebDocument
final case class DesignWorkflow(
    guidanceVersion: String,
    brief: Option[DesignBrief] = None,
    candidate: Option[WebDocument] = None,
    originalLayout: Option[LayoutReport] = None,
    review: Option[DesignReview] = None,
    improved: Option[WebDocument] = None,
    improvedLayout: Option[LayoutReport] = None,
    selection: DesignSelection = DesignSelection.Original,
    events: List[DesignEvent] = Nil,
    visualReferences: Option[List[VisualProfile]] = None,
    contentFocusOnly: Option[Boolean] = None
)
object DesignWorkflow:
  given Encoder[DesignWorkflow] = deriveEncoder
  given Decoder[DesignWorkflow] = deriveDecoder
