package services.generation.utils
import cats.effect.{IO, Resource}
import io.circe.syntax.*
import java.nio.charset.StandardCharsets.UTF_8
import java.nio.file.Paths
import scala.jdk.CollectionConverters.*
import scala.concurrent.duration.*
import services.browser.objects.WebDocument
import services.generation.objects.LayoutReport
private[generation] final class NodeLayoutMeasurer extends LayoutMeasurer:
  def measure(document: WebDocument): IO[LayoutReport] =
    val script = Paths.get("../frontend/dist-measure/measure.mjs").toAbsolutePath.normalize()
    Resource
      .make(
        IO.blocking(
          new ProcessBuilder("node", script.toString)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start()
        )
      )(p =>
        IO.blocking {
          p.descendants().iterator().asScala.foreach(_.destroyForcibly())
          p.destroyForcibly()
        }.void
      )
      .use { process =>
        for
          _ <- IO.blocking {
            val output = process.getOutputStream
            try output.write(document.asJson.noSpaces.getBytes(UTF_8))
            finally output.close()
          }
          bytes <- IO.interruptibleMany(process.getInputStream.readNBytes(262145))
          _ <- IO.raiseWhen(bytes.length > 262144)(new IllegalStateException("布局报告超出预算"))
          result <- IO.fromEither(io.circe.parser.decode[LayoutReport](new String(bytes, UTF_8)))
        yield result
      }
      .timeout(30.seconds)
      .handleErrorWith(e =>
        IO.pure(LayoutReport(Nil, Some("布局测量不可用: " + e.getClass.getSimpleName)))
      )
