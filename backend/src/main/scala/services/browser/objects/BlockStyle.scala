package services.browser.objects
import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*
final case class BlockStyle(variant: BlockVariant, placement: BlockPlacement, columns: Option[Int])
object BlockStyle:
  given Encoder[BlockStyle] = deriveEncoder
  given Decoder[BlockStyle] = Decoder.instance { c =>
    for
      variant <- c.get[Option[BlockVariant]]("variant")
      placement <- c.get[Option[BlockPlacement]]("placement")
      columns <- c.get[Option[Int]]("columns")
    yield BlockStyle(
      variant.getOrElse(BlockVariant.Plain),
      placement.getOrElse(BlockPlacement.Auto),
      columns
    )
  }
