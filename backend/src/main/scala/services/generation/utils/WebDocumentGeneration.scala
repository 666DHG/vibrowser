package services.generation.utils
import cats.effect.IO
import cats.syntax.all.*
import io.circe.parser.parse
import services.browser.objects.*
import services.browser.api.ValidateWebDocumentMessage
import services.system.DatabaseSession
import services.system.objects.AppError
import services.settings.objects.ProviderConnection
import services.generation.api.*
import services.generation.objects.*
private[generation] final class WebDocumentGeneration(
    database: DatabaseSession,
    client: TextGenerationClient
):
  def generate(
      config: ProviderConnection,
      page: PageRecord,
      prompt: String,
      attempt: Int = 0,
      snapshot: Option[PageActionSnapshot] = None
  ): IO[WebDocument] =
    def phase(value: GenerationPhase, n: Int) =
      database.transaction(UpdateGenerationPhaseMessage(page.currentJobId, value, n).plan)
    def validate(text: String): IO[WebDocument] = for
      _ <- phase(GenerationPhase.Validating, attempt + 1)
      raw <- IO.fromEither(WebDocumentDecoder.decode(text))
      normalized <- database.transaction(
        services.browser.api.NormalizeWebDocumentMessage(raw, page.address).plan
      )
      decoded <- IO.fromEither(WebActionResults.combine(normalized, snapshot))
      known = (page.navigationContext.toList.flatMap(_.entities) ++ snapshot.toList.flatMap(
        _.document.entities
      )).distinctBy(_.id)
      merged <- IO.fromEither(
        decoded.entities.traverse(e =>
          known
            .find(_.id == e.id)
            .fold(Right(e): Either[AppError, PageEntity])(InheritedContent.merge(_, e))
        )
      )
      refs = decoded.bindings.map(_.entityId).toSet ++ known.filter(_.id == page.address).map(_.id)
      inherited = decoded.copy(
        entities = merged ++ known.filter(e => refs(e.id) && !merged.exists(_.id == e.id)),
        subjectEntityId = decoded.subjectEntityId.orElse(known.find(_.id == page.address).map(_.id))
      )
      checked <- database.transaction(ValidateWebDocumentMessage(inherited, page.address).plan)
    yield checked
    phase(GenerationPhase.Generating, attempt + 1) *> client
      .complete(config, WebDocumentPrompt.system, prompt, false)
      .attempt
      .flatMap {
        case Right(text) =>
          validate(text).handleErrorWith {
            case e: AppError if attempt == 0 && e.code == "invalid_content" =>
              phase(GenerationPhase.Repairing, 2) *> generate(
                config,
                page,
                WebDocumentPrompt.repair(prompt, text, e.getMessage),
                1,
                snapshot
              )
            case e => IO.raiseError(e)
          }
        case Left(e: AppError)
            if attempt == 0 && Set(
              "provider_content",
              "provider_format",
              "provider_timeout",
              "provider_network",
              "provider_unavailable"
            )(e.code) =>
          phase(GenerationPhase.Retrying, 2) *> generate(config, page, prompt, 1, snapshot)
        case Left(e) => IO.raiseError(e)
      }
