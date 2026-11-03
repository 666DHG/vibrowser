package services.settings.utils
import cats.effect.IO
import com.sun.jna.platform.win32.Crypt32Util
import java.nio.charset.StandardCharsets.UTF_8
import services.system.objects.AppError
object CredentialProtection:
  private[settings] def encrypt(secret: String): IO[Array[Byte]] =
    IO.blocking(Crypt32Util.cryptProtectData(secret.getBytes(UTF_8))).adaptError { case _ =>
      AppError("credential_storage", "无法使用当前 Windows 用户加密凭据", 500)
    }
  private[settings] def decrypt(ciphertext: Array[Byte]): IO[String] =
    IO.blocking(new String(Crypt32Util.cryptUnprotectData(ciphertext), UTF_8)).adaptError {
      case _ => AppError("credential_storage", "凭据无法解密，请在设置中重新填写", 400)
    }
