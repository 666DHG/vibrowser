import { send } from "../system/send";
import { researchSettingsSchema } from "../../shared/research";
export class GetResearchSettingsMessage {
  constructor() {}
  send(signal?: AbortSignal) {
    return send(
      "GetResearchSettingsMessage",
      {},
      researchSettingsSchema,
      signal,
    );
  }
}
