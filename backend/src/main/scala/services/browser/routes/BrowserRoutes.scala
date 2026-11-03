package services.browser.routes
import services.system.objects.RegisteredAPIMessage
import services.browser.api.*
import services.browser.objects.*
import services.browser.objects.apiTypes.*
object BrowserRoutes:
  val apiMessages: List[RegisteredAPIMessage] = List(
    RegisteredAPIMessage[NavigateMessage, NavigationResponse],
    RegisteredAPIMessage[GetPageMessage, PageResponse],
    RegisteredAPIMessage[RetryPageMessage, NavigationResponse]
  )
