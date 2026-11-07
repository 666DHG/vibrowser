package services.companion.utils
import services.companion.objects.CompanionContext
object CompanionRules:
  private[companion] def valid(context: CompanionContext): Boolean =
    context.input.length <= 200 && context.title.length <= 100
  private[companion] def reply(text: String): Option[String] =
    val trimmed = text.trim
    Option.when(
      trimmed.nonEmpty && trimmed.codePointCount(0, trimmed.length) <= 40 && !trimmed.exists(c =>
        c == '<' || c == '>'
      )
    )(trimmed)
