import { send } from "../system/send";
import { researchSourcesSchema } from "../../shared/research";
export class GetPageSourcesMessage {
  constructor(public pageId: string) {}
  send(signal?: AbortSignal) {
    return send(
      "GetPageSourcesMessage",
      { pageId: this.pageId },
      researchSourcesSchema,
      signal,
    );
  }
}
