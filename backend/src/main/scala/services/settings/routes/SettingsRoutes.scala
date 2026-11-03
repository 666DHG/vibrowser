package services.settings.routes
import services.system.objects.RegisteredAPIMessage
import services.settings.api.*
import services.settings.objects.*
import services.settings.objects.apiTypes.*
object SettingsRoutes:
  val apiMessages: List[RegisteredAPIMessage] = List(
    RegisteredAPIMessage[GetSettingsMessage, ProviderSettings],
    RegisteredAPIMessage[SaveSettingsMessage, ProviderSettings],
    RegisteredAPIMessage[ClearCredentialsMessage, ClearCredentialsResponse],
    RegisteredAPIMessage[TestConnectionMessage, ConnectionTestResponse]
  )
