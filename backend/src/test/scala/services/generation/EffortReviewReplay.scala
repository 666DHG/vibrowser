package services.generation

import cats.effect.{IO, IOApp}
import cats.syntax.all.*
import io.circe.Json
import io.circe.parser.parse
import io.circe.syntax.*
import java.nio.file.{Files, Paths}
import scala.jdk.CollectionConverters.*
import services.browser.objects.{PageId, ResearchSnapshot}
import services.browser.tables.PageTable.PageTable
import services.generation.objects.*
import services.generation.utils.*
import services.system.DatabaseSession

/** Revalidate saved refinements with current guards; no generation or stored-page mutations. */
object EffortReviewReplay extends IOApp.Simple:
  def run: IO[Unit] =
    val directory = Paths.get("../.cache/effort-acceptance")
    DatabaseSession
      .resource(
        "jdbc:postgresql://127.0.0.1:55432/vibrowser?currentSchema=effort_acceptance",
        "vibrowser",
        ""
      )
      .use { db =>
        for
          paths <- IO.blocking {
            val entries = Files.list(directory)
            try
              entries.iterator.asScala
                .filter(
                  _.getFileName.toString
                    .matches("[a-z]+-(old-standard|new-standard|new-deep)\\.json")
                )
                .toList
                .sortBy(_.toString)
            finally entries.close()
          }
          rows <- paths.traverse { path =>
            for
              record <- IO.blocking(parse(Files.readString(path)).fold(throw _, identity))
              workflow <- IO.fromEither(record.hcursor.get[DesignWorkflow]("workflow"))
              pageId <- IO.fromEither(record.hcursor.get[PageId]("pageId"))
              page <- db
                .transaction(c => PageTable.findById(c, pageId))
                .flatMap(IO.fromOption(_)(new Exception("Saved page missing")))
              research <- IO.fromEither(record.hcursor.get[Option[ResearchSnapshot]]("research"))
              event = workflow.events.reverse
                .find(e => e.stage == DesignStage.Improve && e.output.nonEmpty)
              result <- event.traverse { e =>
                new WebDocumentGeneration(db, new MockTextGenerationClient)
                  .validate(page, e.output.get, None, research)
                  .attempt
                  .map {
                    case Left(error) => List(error.getMessage)
                    case Right(doc) =>
                      DesignPreservation.issues(
                        workflow.candidate.get,
                        doc,
                        workflow.review.toList.flatMap(_.issues.map(_.target)).toSet
                      )
                  }
              }
            yield Json.obj(
              "sample" -> path.getFileName.toString.asJson,
              "pageId" -> pageId.asJson,
              "originalRefinementStatus" -> event.map(_.status).asJson,
              "originalReason" -> event.flatMap(_.message).asJson,
              "currentIssues" -> result.asJson,
              "currentProtectionAccepts" -> result.map(_.isEmpty).asJson
            )
          }
          _ <- IO.blocking(
            Files.writeString(
              Paths.get("../docs/acceptance/effort-review-replay.json"),
              Json
                .obj(
                  "modelRequests" -> 0.asJson,
                  "storedPagesChanged" -> false.asJson,
                  "scope" -> "Content/action protection only; acceptance here does not assert rendered layout improvement".asJson,
                  "samples" -> rows.asJson
                )
                .spaces2
            )
          )
          _ <- IO.println(s"Replayed ${rows.size} saved samples without model calls")
        yield ()
      }
