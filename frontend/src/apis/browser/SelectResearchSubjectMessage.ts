import { send } from "../system/send";
import { navigationSchema } from "../../shared/pageSpec";
export class SelectResearchSubjectMessage {
  constructor(
    public pageId: string,
    public candidateId: string,
  ) {}
  send(signal?: AbortSignal) {
    return send(
      "SelectResearchSubjectMessage",
      { pageId: this.pageId, candidateId: this.candidateId },
      navigationSchema,
      signal,
    );
  }
}
