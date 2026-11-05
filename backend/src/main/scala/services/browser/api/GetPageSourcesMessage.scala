package services.browser.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.browser.objects.*
import services.browser.tables.ResearchSnapshotTable.ResearchSnapshotTable
final case class GetPageSourcesMessage(pageId: PageId) extends APIMessage[ResearchSourcesResponse]:
  override def plan(c: Connection): IO[ResearchSourcesResponse] = ResearchSnapshotTable
    .get(c, pageId)
    .map(s => ResearchSourcesResponse(s.toList.flatMap(_.sources).map(_.copy(excerpt = ""))))
object GetPageSourcesMessage:
  given Decoder[GetPageSourcesMessage] = deriveDecoder
