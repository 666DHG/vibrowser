package services.generation.utils
import cats.effect.IO
import services.settings.objects.ProviderConnection
private[generation] trait TextGenerationClient:
  def complete(config: ProviderConnection, system: String, prompt: String, test: Boolean): IO[String]
