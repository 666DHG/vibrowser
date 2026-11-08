package services.generation
import cats.effect.{IO, IOApp}
import cats.syntax.all.*
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import services.browser.api.{NormalizeWebDocumentMessage, ValidateWebDocumentMessage}
import services.browser.objects.{WebDocument, WebAction, WebActionKind}
import services.generation.utils.WebDocumentDecoder
import scala.jdk.CollectionConverters.*

/** Produce validated inert visual shells; never render unvalidated model drafts. */
object DesignStagesReplay extends IOApp.Simple:
  def run: IO[Unit] =
    List("academic", "copy", "calendar", "comparison", "docs", "essay").traverse_ { topic =>
      for
        record <- IO.blocking(
          parse(
            Files.readString(Paths.get(s"../.cache/effort-guidance-v9/$topic-new-standard.json"))
          ).toOption.get
        )
        cursor = record.hcursor
        request = cursor.get[String]("request").toOption.get
        address = parse(request.linesIterator.next()).toOption.get.hcursor
          .downField("target")
          .get[String]("address")
          .toOption
          .get
        base = cursor
          .get[WebDocument]("document")
          .toOption
          .orElse(
            cursor
              .get[List[Json]]("attempts")
              .toOption
              .toList
              .flatten
              .flatMap(a =>
                a.hcursor
                  .get[String]("output")
                  .toOption
                  .flatMap(WebDocumentDecoder.decode(_).toOption)
              )
              .headOption
          )
          .get
        workflow = cursor.downField("workflow")
        draft = workflow
          .downField("draft")
          .focus
          .filterNot(_.isNull)
          .orElse(
            workflow
              .get[List[Json]]("events")
              .toOption
              .toList
              .flatten
              .filter(_.hcursor.get[String]("stage").contains("Brief"))
              .flatMap(_.hcursor.get[String]("output").toOption.flatMap(parse(_).toOption))
              .headOption
          )
        stages = List(
          "draft" -> draft.map(d =>
            base.copy(
              html = d.hcursor.get[String]("html").toOption.get,
              css = d.hcursor.get[String]("css").toOption.get
            )
          ),
          "candidate" -> workflow.get[WebDocument]("candidate").toOption,
          "final" -> cursor.get[WebDocument]("document").toOption
        )
        results <- stages.traverse { (stage, document) =>
          document match
            case None =>
              IO.pure(Json.obj("stage" -> stage.asJson, "error" -> "No saved document".asJson))
            case Some(doc) =>
              val parsed = org.jsoup.Jsoup.parseBodyFragment(doc.html)
              parsed
                .select("[data-entity-id], [data-entity-field]")
                .asScala
                .foreach(e => e.removeAttr("data-entity-id").removeAttr("data-entity-field"))
              val forms = parsed.select("form").asScala.toList.zipWithIndex.map { (form, index) =>
                if form.id().isEmpty then form.attr("id", s"audit-form-$index")
                WebAction(
                  s"audit-search-$index",
                  WebActionKind.Search,
                  form.id(),
                  target = Some(address),
                  field = Some("q")
                )
              }
              val shell = doc.copy(
                html = parsed.body().html(),
                entities = Nil,
                bindings = Nil,
                actions = forms,
                initialState = Map.empty,
                persistentKeys = Nil,
                subjectEntityId = None
              )
              NormalizeWebDocumentMessage(shell, address)
                .plan(null)
                .flatMap(d => ValidateWebDocumentMessage(d, address).plan(null))
                .attempt
                .map(result =>
                  Json.obj(
                    "stage" -> stage.asJson,
                    "document" -> result.toOption.asJson,
                    "error" -> result.left.toOption.map(_.getMessage).asJson
                  )
                )
        }
        _ <- IO.blocking {
          val directory = Paths.get("../.cache/design-stages-v9")
          Files.createDirectories(directory)
          Files.writeString(
            directory.resolve(topic + ".json"),
            Json
              .obj(
                "topic" -> topic.asJson,
                "pageId" -> cursor.downField("pageId").focus.get,
                "stages" -> results.asJson
              )
              .spaces2
          )
        }
        _ <- IO.println(
          s"$topic: ${results.count(_.hcursor.downField("document").focus.exists(!_.isNull))} validated visual shells"
        )
      yield ()
    }
