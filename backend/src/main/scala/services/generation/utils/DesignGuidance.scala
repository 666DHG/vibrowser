package services.generation.utils
import java.nio.charset.StandardCharsets.UTF_8
import java.security.MessageDigest
private[generation] object DesignGuidance:
  private def resource(name: String): String =
    val stream = Option(getClass.getResourceAsStream("/design-guidance/" + name))
      .getOrElse(throw new IllegalStateException("Missing packaged design guidance: " + name))
    try new String(stream.readAllBytes(), UTF_8)
    finally stream.close()
  lazy val design: String = resource("design.md")
  lazy val review: String = resource("review.md")
  lazy val version: String = "2-" + MessageDigest
    .getInstance("SHA-256")
    .digest((design + review).getBytes(UTF_8))
    .map(b => f"${b & 0xff}%02x")
    .mkString
