import { send } from "../system/send";
import { responseSchema } from "../../shared/pageSpec";
export class GetPageMessage {
  constructor(
    public pageId: string | null,
    public jobId: string | null = null,
  ) {}
  send(signal?: AbortSignal) {
    return send(
      "GetPageMessage",
      { pageId: this.pageId, jobId: this.jobId },
      responseSchema,
      signal,
    );
  }
}
