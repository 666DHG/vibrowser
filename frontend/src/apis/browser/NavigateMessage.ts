import { send } from "../system/send";
import { navigationSchema } from "../../shared/pageSpec";
export class NavigateMessage {
  constructor(
    public input: string,
    public referrerPageId: string | null = null,
    public sourceBlockId: string | null = null,
  ) {}
  send(signal?: AbortSignal) {
    return send(
      "NavigateMessage",
      {
        input: this.input,
        referrerPageId: this.referrerPageId,
        sourceBlockId: this.sourceBlockId,
      },
      navigationSchema,
      signal,
    );
  }
}
