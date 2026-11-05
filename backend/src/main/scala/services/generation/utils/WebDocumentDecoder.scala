package services.generation.utils
import io.circe.Json
import io.circe.parser.parse
import services.browser.objects.WebDocument
import services.system.objects.AppError
private[generation] object WebDocumentDecoder:
  private def scalar(v: Json): Json =
    if v.isNumber || v.isBoolean then Json.fromString(v.noSpaces) else v
  def decode(text: String): Either[AppError, WebDocument] =
    parse(text)
      .map(_.mapObject { o =>
        o.add(
          "initialState",
          o("initialState").getOrElse(Json.obj()).mapObject(_.mapValues(scalar))
        ).add(
          "actions",
          o("actions")
            .getOrElse(Json.arr())
            .mapArray(
              _.map(_.mapObject(a => a.add("value", scalar(a("value").getOrElse(Json.Null)))))
            )
        )
      })
      .flatMap(_.as[WebDocument])
      .left
      .map(e => AppError("invalid_content", e.getMessage.take(600), 502))
