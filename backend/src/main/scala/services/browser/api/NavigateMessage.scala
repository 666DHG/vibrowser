package services.browser.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.system.objects.AppError
import services.browser.objects.*
import services.browser.objects.apiTypes.*
import services.browser.tables.PageTable.PageTable
import services.generation.tables.GenerationJobTable.GenerationJobTable
import services.generation.objects.*
import services.settings.tables.SettingsTable.SettingsTable
import services.browser.utils.{AddressRules, NavigationContexts}
final case class NavigateMessage(
    input: String,
    referrerPageId: Option[PageId],
    sourceBlockId: Option[String] = None,
    mode: Option[BrowsingMode] = None,
    effort: Option[GenerationEffort] = None
) extends APIMessage[NavigationResponse]:
  override def plan(connection: Connection): IO[NavigationResponse] =
    for
      source <- referrerPageId.fold(IO.pure(Option.empty[PageRecord]))(
        PageTable.findById(connection, _)
      )
      selectedMode = mode.getOrElse(BrowsingMode.Imagination)
      selectedEffort = effort.getOrElse(GenerationEffort.Standard)
      matchingSource = source.filter(_.mode == selectedMode)
      address <- IO.fromEither(
        AddressRules
          .classify(input, matchingSource.map(_.address))
          .left
          .map(m => AppError("invalid_address", m))
      )
      existing <- PageTable.findByAddress(
        connection,
        address.canonical,
        selectedMode,
        selectedEffort
      )
      result <- existing match
        case Some(page) => IO.pure(NavigationResponse(page.id, page.currentJobId, page.status))
        case None =>
          for
            context <- IO.fromEither(
              NavigationContexts
                .capture(
                  matchingSource,
                  if matchingSource.nonEmpty then sourceBlockId else None,
                  address.canonical
                )
                .left
                .map(m => AppError("invalid_source", m))
            )
            config <- SettingsTable.get(connection)
            pageId <- IO(PageId(java.util.UUID.randomUUID().toString))
            jobId <- IO(JobId(java.util.UUID.randomUUID().toString))
            inserted <- PageTable.insertPending(
              connection,
              pageId,
              address,
              jobId,
              matchingSource.map(_.id),
              context,
              selectedMode,
              selectedEffort
            )
            _ <-
              if inserted then
                GenerationJobTable.insertQueued(
                  connection,
                  jobId,
                  Some(pageId),
                  JobKind.Page,
                  config.revision
                )
              else IO.unit
            page <- PageTable
              .findByAddress(connection, address.canonical, selectedMode, selectedEffort)
              .flatMap(IO.fromOption(_)(AppError("internal_error", "页面创建失败", 500)))
          yield NavigationResponse(page.id, page.currentJobId, page.status)
    yield result
object NavigateMessage:
  given Decoder[NavigateMessage] = deriveDecoder
