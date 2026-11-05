package services.browser.api
import cats.effect.IO
import java.sql.Connection
import services.browser.objects.WebDocument
import services.browser.utils.WebDocuments
import services.system.api.APIMessage
final case class ValidateWebDocumentMessage(document: WebDocument, address: String)
    extends APIMessage[WebDocument]:
  override def plan(connection: Connection): IO[WebDocument] =
    IO.fromEither(WebDocuments.prepare(document, address))
