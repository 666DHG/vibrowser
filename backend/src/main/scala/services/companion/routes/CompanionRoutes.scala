package services.companion.routes
import services.system.objects.RegisteredAPIMessage
import services.companion.api.*
import services.companion.objects.CompanionReply
object CompanionRoutes:
  val apiMessages: List[RegisteredAPIMessage] = List(
    RegisteredAPIMessage[RequestCompanionReplyMessage, CompanionReply],
    RegisteredAPIMessage[GetCompanionReplyMessage, CompanionReply]
  )
