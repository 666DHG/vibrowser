package services.settings
import munit.CatsEffectSuite
import services.settings.utils.CredentialProtection
class CredentialSuite extends CatsEffectSuite:
  test("DPAPI protects and restores fake credentials under current user") {
    val secret = "smoke-fake-key-not-a-real-secret"
    for
      encrypted <- CredentialProtection.encrypt(secret)
      _ = assert(!new String(encrypted,java.nio.charset.StandardCharsets.UTF_8).contains(secret))
      clear <- CredentialProtection.decrypt(encrypted)
      _ = assertEquals(clear,secret)
    yield ()
  }
