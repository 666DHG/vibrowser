package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class PageDesign(
    layout: PageLayout,
    typography: Typography,
    density: Density,
    accent: Accent
)
object PageDesign:
  given Encoder[PageDesign] = deriveEncoder
  given Decoder[PageDesign] = Decoder.instance { c =>
    for
      layout <- c.get[Option[PageLayout]]("layout")
      typography <- c.get[Option[Typography]]("typography")
      density <- c.get[Option[Density]]("density")
      accent <- c.get[Option[Accent]]("accent")
    yield PageDesign(
      layout.getOrElse(PageLayout.Classic),
      typography.getOrElse(Typography.Sans),
      density.getOrElse(Density.Comfortable),
      accent.getOrElse(Accent.Blue)
    )
  }
