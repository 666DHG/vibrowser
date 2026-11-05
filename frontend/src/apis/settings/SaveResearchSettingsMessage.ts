import { send } from "../system/send";
import { researchSettingsSchema } from "../../shared/research";
export class SaveResearchSettingsMessage {
  constructor(
    public reuseGenerationKey: boolean,
    public apiKey: string | null = null,
  ) {}
  send(signal?: AbortSignal) {
    return send(
      "SaveResearchSettingsMessage",
      { reuseGenerationKey: this.reuseGenerationKey, apiKey: this.apiKey },
      researchSettingsSchema,
      signal,
    );
  }
}
