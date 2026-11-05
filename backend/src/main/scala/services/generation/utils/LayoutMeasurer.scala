package services.generation.utils
import cats.effect.IO
import services.browser.objects.WebDocument
import services.generation.objects.LayoutReport
private[generation] trait LayoutMeasurer:
  def measure(document: WebDocument): IO[LayoutReport]
