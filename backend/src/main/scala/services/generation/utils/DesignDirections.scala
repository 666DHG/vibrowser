package services.generation.utils
import services.generation.objects.DesignDirection

private[generation] object DesignDirections:
  def select(address: String, directions: List[DesignDirection]): Option[DesignDirection] =
    val eligible = directions
      .take(3)
      .filter { direction =>
        val fields = List(
          direction.concept,
          direction.structure,
          direction.typography,
          direction.contentReason
        )
        fields.forall(s => s.trim.nonEmpty && s.length <= 1200) && fields.map(_.length).sum <= 4000
      }
      .distinct
    Option.when(eligible.nonEmpty)(eligible(Math.floorMod(address.hashCode, eligible.size)))
