package services.generation.utils
import cats.effect.IO
import services.settings.objects.ProviderConnection
import services.browser.objects.ResearchSource
private[generation] final class MockResearchClient extends ResearchClient:
  def search(config: ProviderConnection, query: String): IO[List[ResearchSource]] = IO.pure(
    List(
      ResearchSource(
        "",
        "https://www.tsinghua.edu.cn/",
        "清华大学",
        java.time.Instant.now.toString,
        "清华大学的教学与科研。"
      )
    )
  )
  def fetch(config: ProviderConnection, url: String): IO[String] = IO.pure("清华大学位于北京，开展教育与科研。")
