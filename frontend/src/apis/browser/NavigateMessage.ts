import type { BrowsingMode } from "../../shared/browsingMode";
import type { GenerationEffort } from "../../shared/generationEffort";
import { send } from "../system/send";
import { navigationSchema } from "../../shared/pageSpec";
export class NavigateMessage {
  constructor(
    public input: string,
    public referrerPageId: string | null = null,
    public sourceBlockId: string | null = null,
    public mode: BrowsingMode = "imagination",
    public effort: GenerationEffort = "standard",
  ) {}
  send(signal?: AbortSignal) {
    return send(
      "NavigateMessage",
      {
        input: this.input,
        mode: this.mode,
        effort: this.effort,
        referrerPageId: this.referrerPageId,
        sourceBlockId: this.sourceBlockId,
      },
      navigationSchema,
      signal,
    );
  }
}
