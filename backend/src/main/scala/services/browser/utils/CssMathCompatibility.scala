package services.browser.utils
import com.helger.css.parser.{CSSCharStream, ParserCSS30TokenManager}
import com.helger.css.parser.ParserCSS30Constants.*
import java.io.StringReader
import scala.collection.mutable

/** ph-css accepts arithmetic in calc(), but drops it directly inside min/max/clamp. Use its lexer
  * to wrap only arithmetic arguments; full CSS parsing still follows.
  */
private[browser] object CssMathCompatibility:
  def prepare(source: String): String =
    val lineStarts = mutable.ArrayBuffer(0)
    var i = 0
    while i < source.length do
      if source(i) == '\r' then
        if i + 1 < source.length && source(i + 1) == '\n' then i += 1
        lineStarts += i + 1
      else if source(i) == '\n' then lineStarts += i + 1
      i += 1
    def offset(line: Int, column: Int): Int = lineStarts(line - 1) + column - 1
    val stream = new CSSCharStream(new StringReader(source))
    stream.setTabSize(1)
    val lexer = new ParserCSS30TokenManager(stream)
    // Each entry tracks a parenthesis, the start of its current argument and direct arithmetic.
    var frames = List.empty[(Boolean, Int, Boolean)]
    val insertions = mutable.Map.empty[Int, String]
    def finish(end: Int): Unit = frames.headOption.foreach { (math, start, arithmetic) =>
      if math && arithmetic then
        insertions.update(start, insertions.getOrElse(start, "") + "calc(")
        insertions.update(end, ")" + insertions.getOrElse(end, ""))
    }
    var token = lexer.getNextToken()
    while token.kind != EOF do
      val start = offset(token.beginLine, token.beginColumn)
      val end = offset(token.endLine, token.endColumn) + 1
      val function = tokenImage(token.kind).startsWith("<FUNCTION")
      if function || token.kind == LROUND then
        val math = function && Set("min(", "max(", "clamp(").contains(
          token.image.toLowerCase(java.util.Locale.ROOT)
        )
        frames = (math, end, false) :: frames
      else if token.kind == RROUND && frames.nonEmpty then
        finish(start)
        frames = frames.tail
      else if token.kind == COMMA && frames.nonEmpty then
        finish(start)
        frames = (frames.head._1, end, false) :: frames.tail
      else if frames.headOption.exists(_._1) && Set("+", "-", "*", "/")(token.image) then
        frames = (true, frames.head._2, true) :: frames.tail
      token = lexer.getNextToken()
    if insertions.isEmpty then source
    else
      val result = new StringBuilder
      for index <- 0 to source.length do
        insertions.get(index).foreach(result.append)
        if index < source.length then result.append(source(index))
      result.toString
