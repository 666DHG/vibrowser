package services.browser.routes
import services.system.objects.RegisteredAPIMessage
import services.browser.api.*
import services.browser.objects.*
import services.browser.objects.apiTypes.*
object BrowserRoutes:
  val apiMessages: List[RegisteredAPIMessage] = List(
    RegisteredAPIMessage[NavigateMessage, NavigationResponse],
    RegisteredAPIMessage[SubmitPageActionMessage, NavigationResponse],
    RegisteredAPIMessage[GetPageMessage, PageResponse],
    RegisteredAPIMessage[RetryPageMessage, NavigationResponse],
    RegisteredAPIMessage[ListBookmarksMessage, BookmarkListResponse],
    RegisteredAPIMessage[SaveBookmarkMessage, Bookmark],
    RegisteredAPIMessage[RemoveBookmarkMessage, BookmarkRemovalResponse]
  )
