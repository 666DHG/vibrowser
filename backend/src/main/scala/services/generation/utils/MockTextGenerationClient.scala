package services.generation.utils
import cats.effect.IO
import java.nio.file.{Files, Paths}
import scala.concurrent.duration.*
import io.circe.parser.{parse, decode}
import io.circe.syntax.*
import services.browser.objects.*
import services.settings.objects.ProviderConnection
private[generation] final class MockTextGenerationClient extends TextGenerationClient:
  def complete(
      config: ProviderConnection,
      system: String,
      prompt: String,
      test: Boolean
  ): IO[String] =
    IO.sleep(400.millis) *> (if test then IO.pure("""{"ok":true}""")
                             else if system.contains("WebDocument v3") then
                               IO.blocking {
                                 val file =
                                   if prompt.contains("商店") || prompt.contains("shop") then "shop"
                                   else if prompt.contains("文档") || prompt.contains("docs") then
                                     "docs"
                                   else "forum"
                                 Files.readString(
                                   Paths.get("../contracts/web-documents/" + file + ".json")
                                 )
                               }
                             else
                               IO.blocking {
                                 val file =
                                   if prompt.contains("PAGE_KIND=search") then "search.json"
                                   else "moon-coffee.json"
                                 val spec = decode[PageSpec](
                                   Files.readString(
                                     Paths.get("../contracts/fixtures/valid/" + file)
                                   )
                                 ).toOption.get
                                 val request = prompt.linesIterator
                                   .drop(1)
                                   .nextOption
                                   .flatMap(s => parse(s).toOption)
                                 val context = request.flatMap(
                                   _.hcursor
                                     .get[Option[NavigationContext]]("navigationContext")
                                     .toOption
                                     .flatten
                                 )
                                 val entity =
                                   context.flatMap(c => c.entities.find(_.id == c.target))
                                 val blocks = spec.blocks.map(b =>
                                   if b.`type` == BlockType.Hero then
                                     b.copy(entityId = entity.map(_.id))
                                   else b
                                 )
                                 spec
                                   .copy(
                                     schemaVersion = 2,
                                     blocks = blocks,
                                     entities = entity.toList,
                                     subjectEntityId = entity.map(_.id)
                                   )
                                   .asJson
                                   .noSpaces
                               })
