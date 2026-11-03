import { send } from "../system/send";
import { settingsSchema } from "../../shared/pageSpec";
export class SaveSettingsMessage {
  constructor(
    public baseUrl: string,
    public model: string,
    private apiKey: string | null,
  ) {}
  send(signal?: AbortSignal) {
    return send(
      "SaveSettingsMessage",
      { baseUrl: this.baseUrl, model: this.model, apiKey: this.apiKey },
      settingsSchema,
      signal,
    );
  }
}
