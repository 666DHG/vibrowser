import { send } from "../system/send";
import { bookmarkListSchema } from "../../shared/bookmark";
export class ListBookmarksMessage {
  send(signal?: AbortSignal) {
    return send("ListBookmarksMessage", {}, bookmarkListSchema, signal);
  }
}
