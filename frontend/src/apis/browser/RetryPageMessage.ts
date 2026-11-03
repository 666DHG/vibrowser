import { send } from "../system/send";
import { navigationSchema } from "../../shared/pageSpec";
export class RetryPageMessage {
  constructor(
    public pageId: string,
    public failedJobId: string,
  ) {}
  send(signal?: AbortSignal) {
    return send(
      "RetryPageMessage",
      { pageId: this.pageId, failedJobId: this.failedJobId },
      navigationSchema,
      signal,
    );
  }
}
