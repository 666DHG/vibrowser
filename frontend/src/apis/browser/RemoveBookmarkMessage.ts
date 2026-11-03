import { send } from "../system/send";
import { bookmarkRemovalSchema } from "../../shared/bookmark";
export class RemoveBookmarkMessage {
  constructor(public bookmarkId: string) {}
  send(signal?: AbortSignal) {
    return send(
      "RemoveBookmarkMessage",
      { bookmarkId: this.bookmarkId },
      bookmarkRemovalSchema,
      signal,
    );
  }
}
