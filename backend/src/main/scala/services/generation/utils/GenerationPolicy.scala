package services.generation.utils
import scala.concurrent.duration.*
private[generation] object GenerationPolicy:
  val maxDocumentRequests = 4
  val requestTimeout = 180.seconds
  val responseBytes = 1048576
  // The official output budget includes reasoning as well as the document.
  val officialOutputTokens = 48000
  val deepOutputTokens = 48000
