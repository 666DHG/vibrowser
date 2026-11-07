package services.settings.objects
import services.generation.objects.GenerationEffort
// Runtime secret capability: deliberately has no JSON encoder and never crosses HTTP.
final class ProviderConnection(
    val baseUrl: String,
    val model: String,
    val key: String,
    val revision: Long,
    val effort: GenerationEffort = GenerationEffort.Standard
):
  override def toString: String = "ProviderConnection([redacted])"
