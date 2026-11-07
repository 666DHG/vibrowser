package services.browser.objects
import services.generation.objects.JobId
import services.generation.objects.GenerationEffort
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

final case class PageRecord(
    id: PageId,
    address: String,
    kind: PageKind,
    prompt: String,
    status: PageStatus,
    spec: Option[PageSpec],
    currentJobId: JobId,
    referrerId: Option[PageId],
    error: Option[String],
    source: String,
    navigationContext: Option[NavigationContext] = None,
    document: Option[WebDocument] = None,
    mode: BrowsingMode = BrowsingMode.Imagination,
    sourceCount: Int = 0,
    effort: GenerationEffort = GenerationEffort.Standard
)
object PageRecord:
  given Encoder[PageRecord] = deriveEncoder
  given Decoder[PageRecord] = deriveDecoder[PageRecord].prepare(
    _.withFocus(json =>
      if json.hcursor.downField("effort").succeeded then json
      else json.mapObject(_.add("effort", io.circe.Json.fromString("standard")))
    )
  )
