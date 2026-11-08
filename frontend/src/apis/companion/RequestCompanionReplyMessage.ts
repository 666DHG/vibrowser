import { send } from "../system/send";
import { companionReplySchema } from "../../shared/companion";
import type { CompanionContext } from "../../shared/companion";
export class RequestCompanionReplyMessage {
  constructor(readonly context: CompanionContext) {}
  send(signal?: AbortSignal) {
    return send(
      "RequestCompanionReplyMessage",
      { context: this.context },
      companionReplySchema,
      signal,
    );
  }
}
