package services.generation.utils
import scala.concurrent.duration.*
private[generation] object GenerationPolicy:
  val maxDocumentRequests = 4
  val requestTimeout = 180.seconds
  val responseBytes = 1048576
  val officialOutputTokens = 24000
