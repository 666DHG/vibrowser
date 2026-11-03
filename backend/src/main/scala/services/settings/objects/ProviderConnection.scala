package services.settings.objects
// Runtime secret capability: deliberately has no JSON encoder and never crosses HTTP.
final class ProviderConnection(val baseUrl: String, val model: String, val key: String, val revision: Long):
  override def toString: String = "ProviderConnection([redacted])"
