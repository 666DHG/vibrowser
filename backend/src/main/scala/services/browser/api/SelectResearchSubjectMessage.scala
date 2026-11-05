package services.browser.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.system.objects.AppError
import services.browser.objects.*
import services.browser.objects.apiTypes.NavigationResponse
import services.browser.tables.ResearchSnapshotTable.ResearchSnapshotTable
import services.browser.tables.PageTable.PageTable
import services.generation.tables.GenerationJobTable.GenerationJobTable
final case class SelectResearchSubjectMessage(pageId: PageId, candidateId: String)
    extends APIMessage[NavigationResponse]:
  override def plan(c: Connection): IO[NavigationResponse] = for
    page <- PageTable
      .lockById(c, pageId)
      .flatMap(IO.fromOption(_)(AppError("not_found", "页面不存在", 404)))
    snapshot <- ResearchSnapshotTable
      .get(c, pageId)
      .flatMap(IO.fromOption(_)(AppError("not_found", "检索记录不存在", 404)))
    _ <- IO.raiseUnless(snapshot.candidates.exists(_.id == candidateId))(
      AppError("invalid_candidate", "请选择列表中的对象")
    )
    _ <- IO.raiseWhen(snapshot.selectedCandidateId.exists(_ != candidateId))(
      AppError("candidate_selected", "已经选择了其他对象", 409)
    )
    _ <- ResearchSnapshotTable.save(c, snapshot.copy(selectedCandidateId = Some(candidateId)))
    _ <- GenerationJobTable.resumeChoice(c, page.currentJobId)
  yield NavigationResponse(page.id, page.currentJobId, page.status)
object SelectResearchSubjectMessage:
  given Decoder[SelectResearchSubjectMessage] = deriveDecoder
