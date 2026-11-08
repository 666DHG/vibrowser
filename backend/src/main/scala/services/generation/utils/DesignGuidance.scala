package services.generation.utils
import java.nio.charset.StandardCharsets.UTF_8
import java.security.MessageDigest
import services.generation.objects.DesignGuidanceText
private[generation] object DesignGuidance:
  private def resource(name: String): String =
    val stream = Option(getClass.getResourceAsStream("/design-guidance/" + name))
      .getOrElse(throw new IllegalStateException("Missing packaged design guidance: " + name))
    try new String(stream.readAllBytes(), UTF_8)
    finally stream.close()
  lazy val design: String = resource("design.md")
  lazy val review: String = resource("review.md")
  lazy val intent: String = resource("intent.md")
  lazy val version: String = "7-" + MessageDigest
    .getInstance("SHA-256")
    .digest((intent + design + review).getBytes(UTF_8))
    .map(b => f"${b & 0xff}%02x")
    .mkString
  lazy val current: DesignGuidanceText =
    DesignGuidanceText(
      version,
      design,
      review,
      Some(intent),
      visualContext = true,
      contentFocusOnly = true
    )
