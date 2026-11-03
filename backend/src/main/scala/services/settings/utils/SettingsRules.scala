package services.settings.utils
import java.net.URI
import scala.util.Try
import services.system.objects.AppError
object SettingsRules:
  private[settings] def normalize(raw: String): Either[AppError,String] =
    Try(new URI(raw.trim.stripSuffix("/"))).toEither.left.map(_ => AppError("invalid_url","接口地址无效")).flatMap { uri =>
      val valid = uri.getScheme == "https" && Option(uri.getHost).exists(_.contains(".")) &&
        uri.getUserInfo == null && uri.getQuery == null && uri.getFragment == null &&
        !Option(uri.getHost).exists(h => h == "localhost" || h.endsWith(".local") || h.matches("^[0-9.]+$"))
      Either.cond(valid,uri.toString,AppError("invalid_url","接口需要 HTTPS 公网域名，且不含凭据、查询或片段"))
    }
