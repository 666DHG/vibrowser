package services.browser.api
import cats.effect.IO
import java.sql.Connection
import io.circe.Decoder
import io.circe.generic.semiauto.*
import services.system.api.APIMessage
import services.system.objects.AppError
import services.browser.objects.*
import services.browser.utils.PageValidation
final case class ValidateGeneratedContentMessage(spec: PageSpec, address: String)
    extends APIMessage[List[ValidationIssue]]:
  override def plan(connection: Connection): IO[List[ValidationIssue]] =
    IO.pure(PageValidation.validate(spec, address))
object ValidateGeneratedContentMessage:
  given Decoder[ValidateGeneratedContentMessage] = deriveDecoder
