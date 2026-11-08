package services.generation.api
import cats.effect.IO
import java.sql.Connection
import java.net.URI
import java.util.Locale
import services.system.api.APIMessage
import services.system.objects.AppError
import services.browser.objects.PageId
import services.browser.tables.PageTable.PageTable
import services.generation.objects.VisualProfile
import services.generation.tables.GenerationJobTable.GenerationJobTable
final case class GetRecentVisualProfilesMessage(pageId: PageId)
    extends APIMessage[List[VisualProfile]]:
  private def authority(address: String): String =
    URI.create(address).getRawAuthority.toLowerCase(Locale.ROOT)
  override def plan(connection: Connection): IO[List[VisualProfile]] =
    for
      page <- PageTable
        .findById(connection, pageId)
        .flatMap(p => IO.fromOption(p)(AppError("page_missing", "页面不存在", 404)))
      parent <- page.referrerId.fold(IO.pure(Option.empty[services.browser.objects.PageRecord]))(
        PageTable.findById(connection, _)
      )
      inherited = page.navigationContext.exists(c =>
        c.siteStyle.nonEmpty || c.appearance.nonEmpty
      ) ||
        parent.exists(p => p.mode == page.mode && authority(p.address) == authority(page.address))
      profiles <-
        if inherited then IO.pure(List.empty[VisualProfile])
        else
          GenerationJobTable.recentVisualProfiles(
            connection,
            page.mode,
            authority(page.address)
          )
    yield profiles
