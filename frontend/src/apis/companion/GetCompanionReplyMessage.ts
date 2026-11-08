import { send } from "../system/send";
import { companionReplySchema } from "../../shared/companion";
export class GetCompanionReplyMessage {
  constructor(readonly id: string) {}
  send(signal?: AbortSignal) {
    return send(
      "GetCompanionReplyMessage",
      { id: this.id },
      companionReplySchema,
      signal,
    );
  }
}
