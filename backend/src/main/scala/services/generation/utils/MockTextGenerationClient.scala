package services.generation.utils
import cats.effect.IO
import java.nio.file.{Files,Paths}
import scala.concurrent.duration.*
import services.settings.objects.ProviderConnection
private[generation] final class MockTextGenerationClient extends TextGenerationClient:
  def complete(config: ProviderConnection, system: String, prompt: String, test: Boolean): IO[String] =
    IO.sleep(400.millis) *> (if test then IO.pure("""{"ok":true}""") else
      IO.blocking(Files.readString(Paths.get("../contracts/fixtures/valid/" +
        (if prompt.contains("PAGE_KIND=search") then "search.json" else "moon-coffee.json")))))
