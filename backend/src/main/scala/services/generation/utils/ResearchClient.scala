package services.generation.utils
import cats.effect.IO
import services.settings.objects.ProviderConnection
import services.browser.objects.ResearchSource
private[generation] trait ResearchClient:
  def search(config: ProviderConnection, query: String): IO[List[ResearchSource]]
  def fetch(config: ProviderConnection, url: String): IO[String]
