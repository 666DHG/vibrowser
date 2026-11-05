package services.generation.utils
import io.circe.Json
import io.circe.parser.parse
import services.browser.objects.{WebDocument, WebActionKind, EntityField}
import services.system.objects.AppError
private[generation] object WebDocumentDecoder:
  private def scalar(v: Json): Json =
    if v.isNumber || v.isBoolean then Json.fromString(v.noSpaces) else v
  private def named(v: Json, names: List[String]): Json =
    v.asString.flatMap(s => names.find(_.equalsIgnoreCase(s))).fold(v)(Json.fromString)
  def decode(text: String): Either[AppError, WebDocument] =
    val trimmed = text.trim.stripPrefix("\ufeff")
    val body =
      if trimmed.startsWith("```json\n") && trimmed.endsWith("```") then
        trimmed.stripPrefix("```json\n").stripSuffix("```").trim
      else if trimmed.startsWith("```\n") && trimmed.endsWith("```") then
        trimmed.stripPrefix("```\n").stripSuffix("```").trim
      else trimmed
    parse(body)
      .map(_.mapObject { original =>
        val o = List("actions", "bindings", "entities", "persistentKeys").foldLeft(original)(
          (o, k) => if o(k).forall(_.isNull) then o.add(k, Json.arr()) else o
        )
        o.add(
          "initialState",
          o("initialState").filterNot(_.isNull).getOrElse(Json.obj()).mapObject(_.mapValues(scalar))
        ).add(
          "actions",
          o("actions").get.mapArray(
            _.map(
              _.mapObject(a =>
                a.add("value", scalar(a("value").getOrElse(Json.Null)))
                  .add(
                    "kind",
                    named(
                      a("kind").getOrElse(Json.Null),
                      WebActionKind.values.toList.map(_.toString)
                    )
                  )
              )
            )
          )
        ).add(
          "bindings",
          o("bindings").get.mapArray(
            _.map(
              _.mapObject(b =>
                b.add(
                  "field",
                  named(b("field").getOrElse(Json.Null), EntityField.values.toList.map(_.toString))
                )
              )
            )
          )
        )
      })
      .flatMap(_.as[WebDocument])
      .left
      .map(e => AppError("invalid_content", e.getMessage.take(2000), 502))
