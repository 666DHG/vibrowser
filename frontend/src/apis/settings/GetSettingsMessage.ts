import { send } from "../system/send";
import { settingsSchema } from "../../shared/pageSpec";
export class GetSettingsMessage {
  constructor() {}
  send(signal?: AbortSignal) {
    return send("GetSettingsMessage", {}, settingsSchema, signal);
  }
}
