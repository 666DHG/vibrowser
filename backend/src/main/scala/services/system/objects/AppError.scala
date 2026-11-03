package services.system.objects
final case class AppError(code: String, override val getMessage: String, status: Int = 400)
    extends RuntimeException(getMessage)
