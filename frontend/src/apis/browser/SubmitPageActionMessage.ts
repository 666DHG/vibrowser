import { send } from "../system/send";
import { navigationSchema } from "../../shared/pageSpec";
export class SubmitPageActionMessage {
  constructor(
    public pageId: string,
    public actionId: string,
    public revision: string,
    public requestId: string,
    public values: Record<string, string>,
  ) {}
  send(signal?: AbortSignal) {
    return send(
      "SubmitPageActionMessage",
      {
        pageId: this.pageId,
        actionId: this.actionId,
        revision: this.revision,
        requestId: this.requestId,
        values: this.values,
      },
      navigationSchema,
      signal,
    );
  }
}
