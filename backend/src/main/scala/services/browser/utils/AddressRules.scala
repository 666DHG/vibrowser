package services.browser.utils
import java.net.{URI, IDN, URLEncoder}
import java.nio.charset.StandardCharsets.UTF_8
import scala.util.Try
import services.browser.objects.*
object AddressRules:
  private[browser] def classify(
      raw: String,
      source: Option[String]
  ): Either[String, VirtualAddress] =
    val input = raw.trim
    if input.isEmpty || input.length > 2048 then Left("请输入网址或搜索词（最多 2048 字符）")
    else if input.startsWith("/") && source.nonEmpty then
      Try(URI.create(source.get).resolve(input).toString).toEither.left
        .map(_ => "链接无效")
        .flatMap(web)
    else if !input.contains("://") && !input.exists(_.isWhitespace) && input
        .takeWhile(c => c != '/' && c != '?' && c != '#')
        .contains(".")
    then web("https://" + input)
    else if input.matches("(?i)^[a-z][a-z0-9+.-]*:.*") then web(input)
    else
      Right(
        VirtualAddress("vibe://search?q=" + URLEncoder.encode(input, UTF_8), PageKind.Search, input)
      )
  private[browser] def web(raw: String): Either[String, VirtualAddress] =
    Try {
      val uri = new URI(raw)
      val scheme = Option(uri.getScheme).getOrElse("").toLowerCase(java.util.Locale.ROOT)
      val authority = Option(uri.getRawAuthority).getOrElse("")
      val host = Option(uri.getHost).getOrElse(authority.takeWhile(_ != ':'))
      val asciiHost = IDN.toASCII(host, IDN.USE_STD3_ASCII_RULES).toLowerCase(java.util.Locale.ROOT)
      val explicitPort = if authority.contains(":") then
        val value = authority.substring(authority.lastIndexOf(':') + 1)
        require(value.matches("[0-9]+"))
        val parsed = value.toInt
        require(parsed >= 1 && parsed <= 65535)
        parsed
      else -1
      val forbidden =
        asciiHost == "localhost" || asciiHost.endsWith(".localhost") || asciiHost.endsWith(
          ".local"
        ) ||
          asciiHost == "::1" || asciiHost.contains(":") ||
          asciiHost.matches("(?i)^(0|10|127|169\\.254|192\\.168)\\..*") ||
          asciiHost.matches("^172\\.(1[6-9]|2[0-9]|3[01])\\..*") ||
          asciiHost.matches("^[0-9.]+$")
      require(
        Set("http", "https")(scheme) && asciiHost.contains(".") && !forbidden && !authority
          .contains("@") && uri.getUserInfo == null
      )
      require(!raw.exists(c => c < ' ' || c == '\\'))
      val port =
        if (scheme == "https" && explicitPort == 443) || (scheme == "http" && explicitPort == 80)
        then -1
        else explicitPort
      val path = Option(uri.getRawPath).filter(_.nonEmpty).getOrElse("/")
      val normalized = scheme + "://" + asciiHost + (if port == -1 then "" else ":" + port) + path +
        Option(uri.getRawQuery).fold("")("?" + _)
      VirtualAddress(normalized, PageKind.Website, normalized)
    }.toEither.left.map(_ => "网址无效：请使用公开域名的 http/https 地址")
  private[browser] def resolveLink(target: String, source: String): Either[String, String] =
    Try(new URI(source).resolve(target).toString).toEither.left
      .map(_ => "链接格式无效")
      .flatMap(web)
      .map(_.canonical)
