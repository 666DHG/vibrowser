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
    IO.sleep(
      400.millis
    ) *> (if test then IO.pure("""{"ok":true}""")
          else if system.startsWith("ResearchPlan") then
            IO.pure("""{"topic":"检索主题","queries":[],"reuseSources":true,"candidates":[]}""")
          else if system.contains("WebDocument v3") then
            IO.blocking {
              val file =
                if prompt.contains("商店") || prompt.contains("shop") then "shop"
                else if prompt.contains("文档") || prompt.contains("docs") then "docs"
                else "forum"
              val document = decode[WebDocument](
                Files.readString(
                  Paths.get("../contracts/web-documents/" + file + ".json")
                )
              ).toOption.get
              val snapshot = prompt.linesIterator
                .find(_.startsWith("操作快照："))
                .flatMap(line => decode[PageActionSnapshot](line.stripPrefix("操作快照：")).toOption)
              snapshot match
                case Some(s) if s.action.kind != WebActionKind.Search =>
                  document
                    .copy(
                      html = "<article id='more-" + s.resultPageId.value + "'>新的讨论内容</article>",
                      css = "",
                      actions = Nil,
                      bindings = Nil,
                      entities = Nil,
                      initialState = Map.empty,
                      persistentKeys = Nil
                    )
                    .asJson
                    .noSpaces
                case Some(s) =>
                  document
                    .copy(
                      title = s.values.getOrElse("q", "") + " · 搜索",
                      siteStyle = s.document.siteStyle
                    )
                    .asJson
                    .noSpaces
                case None => document.asJson.noSpaces
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
                if b.`type` == BlockType.Hero then b.copy(entityId = entity.map(_.id))
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
