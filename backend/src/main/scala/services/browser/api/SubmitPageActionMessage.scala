package services.browser.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.system.objects.AppError
import services.browser.objects.*
import services.browser.objects.apiTypes.NavigationResponse
import services.browser.tables.PageTable.PageTable
import services.browser.tables.PageActionTable.PageActionTable
import services.generation.objects.*
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.settings.tables.SettingsTable.SettingsTable
final case class SubmitPageActionMessage(
    pageId: PageId,
    actionId: String,
    revision: String,
    requestId: String,
    values: Map[String, String]
) extends APIMessage[NavigationResponse]:
  override def plan(c: Connection): IO[NavigationResponse] = for
    _ <- IO.raiseWhen(
      requestId.length > 100 || values.size > 32 || values.values.map(_.length).sum > 12000
    )(AppError("invalid_request", "表单内容过长"))
    _ <- PageActionTable.lockRequest(c, requestId)
    existing <- PageActionTable.find(c, requestId)
    result <- existing match
      case Some(snapshot) =>
        IO.raiseWhen(
          snapshot.sourcePageId != pageId || snapshot.action.id != actionId || snapshot.values != values
        )(AppError("request_conflict", "请求标识已用于其他操作", 409)) *> PageTable
          .findById(c, snapshot.resultPageId)
          .map(_.get)
          .map(p => NavigationResponse(p.id, p.currentJobId, p.status))
      case None =>
        for
          page <- PageTable
            .findById(c, pageId)
            .flatMap(IO.fromOption(_)(AppError("not_found", "页面不存在", 404)))
          _ <- IO.raiseWhen(page.status != PageStatus.Ready || revision != page.currentJobId.value)(
            AppError("stale_page", "页面版本已变化", 409)
          )
          doc <- IO.fromOption(page.document)(AppError("invalid_action", "当前页面不支持此操作"))
          action <- IO
            .fromOption(doc.actions.find(_.id == actionId))(AppError("invalid_action", "动作不存在"))
          _ <- IO.raiseUnless(
            Set(
              WebActionKind.Search,
              WebActionKind.Submit,
              WebActionKind.Replace,
              WebActionKind.Append
            )(action.kind)
          )(AppError("invalid_action", "该动作应在本地执行"))
          element = org.jsoup.Jsoup.parseBodyFragment(doc.html).getElementById(action.elementId)
          _ <- IO.raiseWhen(element != null && element.normalName() == "form" && {
            import scala.jdk.CollectionConverters.*
            val fields = element.select("[name]").asScala.toList
            values.keys.exists(key => !fields.exists(_.attr("name") == key)) || fields
              .filter(_.hasAttr("required"))
              .exists(f => values.getOrElse(f.attr("name"), "").trim.isEmpty)
          })(AppError("invalid_form", "请填写有效表单字段"))
          target =
            if action.kind == WebActionKind.Search then
              new java.net.URI(page.address)
                .resolve(
                  "/search?q=" + java.net.URLEncoder
                    .encode(values.getOrElse("q", ""), java.nio.charset.StandardCharsets.UTF_8)
                )
                .toString
            else page.address
          config <- SettingsTable.get(c)
          id <- IO(PageId(java.util.UUID.randomUUID().toString))
          job <- IO(JobId(java.util.UUID.randomUUID().toString))
          _ <- PageTable.insertVersion(
            c,
            id,
            VirtualAddress(target, PageKind.Website, values.getOrElse("q", page.prompt)),
            job,
            page
          )
          _ <- PageActionTable.insert(
            c,
            PageActionSnapshot(requestId, pageId, id, action, values, revision, doc)
          )
          _ <- GenerationJobTable.insertQueued(c, job, Some(id), JobKind.Action, config.revision)
        yield NavigationResponse(id, job, PageStatus.Generating)
  yield result
object SubmitPageActionMessage:
  given Decoder[SubmitPageActionMessage] = deriveDecoder
