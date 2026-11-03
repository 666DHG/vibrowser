package services.generation.utils
import java.net.{URI, IDN}
import services.browser.objects.{PageRecord, PageKind}
import services.generation.objects.GenerationTarget

private[generation] object GenerationTargets:
  private[generation] def describe(page: PageRecord): GenerationTarget =
    if page.kind == PageKind.Search then
      GenerationTarget(
        page.address,
        page.prompt,
        page.kind,
        page.prompt,
        None,
        None,
        Some(page.prompt)
      )
    else
      val uri = URI.create(page.address)
      val host = IDN.toUnicode(uri.getHost)
      val path = Option(uri.getPath).getOrElse("/")
      val query = Option(uri.getQuery)
      val readable =
        uri.getScheme + "://" + host + (if uri.getPort == -1 then ""
                                        else ":" + uri.getPort) + path + query.fold("")("?" + _)
      GenerationTarget(
        page.address,
        page.prompt,
        page.kind,
        readable,
        Some(host),
        Some(path),
        query
      )
