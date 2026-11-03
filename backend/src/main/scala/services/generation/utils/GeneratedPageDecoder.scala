package services.generation.utils
import io.circe.{Json, JsonObject, DecodingFailure, CursorOp}
import io.circe.parser.parse
import services.browser.objects.PageSpec
import services.system.objects.AppError

/** Normalize unambiguous provider shorthand; the persisted PageSpec remains strict. */
private[generation] object GeneratedPageDecoder:
  private[generation] def decode(text: String): Either[AppError, PageSpec] =
    parse(text).left
      .map(_ => AppError("invalid_content", "模型输出不是合法 JSON", 502))
      .flatMap(json =>
        normalize(json).as[PageSpec].left.map { failure =>
          val path = CursorOp.opsToPath(failure.history)
          AppError(
            "invalid_content",
            s"PageSpec ${if path.isEmpty then "$" else path}: ${failure.message.take(180)}",
            502
          )
        }
      )

  private def normalize(json: Json): Json =
    def block(value: Json, parent: Option[String], path: String, depth: Int): Json =
      if depth > 3 then value
      else
        value.asObject.fold(value) { fields =>
          val inferred = parent match
            case Some("navbar") if fields.contains("label") && fields.contains("href") =>
              Some("button")
            case Some("grid" | "results") if fields.contains("title") => Some("card")
            case _                                                    => None
          val withType =
            if fields.contains("type") then fields
            else inferred.fold(fields)(kind => fields.add("type", Json.fromString(kind)))
          val kind = withType("type").flatMap(_.asString)
          val withId =
            if withType.contains("id") then withType
            else withType.add("id", Json.fromString("generated-" + path))
          val withTitle =
            if withId.contains("title") then withId
            else withId.add("title", fields("label").getOrElse(Json.Null))
          val withTarget =
            if withTitle.contains("target") then withTitle
            else withTitle.add("target", fields("href").getOrElse(Json.Null))
          val withText =
            if withTarget.contains("text") then withTarget
            else withTarget.add("text", Json.Null)
          val items = fields("items") match
            case None | Some(Json.Null) => Json.arr()
            case Some(children) =>
              children.asArray.fold(children)(values =>
                Json.fromValues(
                  values.zipWithIndex.map((child, index) =>
                    block(child, kind, s"$path-$index", depth + 1)
                  )
                )
              )
          Json.fromJsonObject(withText.add("items", items))
        }
    json.mapObject { fields =>
      fields("blocks").flatMap(_.asArray).fold(fields) { values =>
        fields.add(
          "blocks",
          Json.fromValues(
            values.zipWithIndex.map((value, index) => block(value, None, index.toString, 1))
          )
        )
      }
    }
