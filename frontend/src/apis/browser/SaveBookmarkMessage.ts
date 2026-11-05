import { send } from "../system/send";
import { bookmarkSchema } from "../../shared/bookmark";
export class SaveBookmarkMessage {
  constructor(
    public pageId: string,
    public state?: Record<string, string>,
  ) {}
  send(signal?: AbortSignal) {
    return send(
      "SaveBookmarkMessage",
      { pageId: this.pageId, state: this.state },
      bookmarkSchema,
      signal,
    );
  }
}
