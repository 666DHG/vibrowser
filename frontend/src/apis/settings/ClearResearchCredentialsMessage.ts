import { send } from "../system/send";
import { researchSettingsSchema } from "../../shared/research";
export class ClearResearchCredentialsMessage {
  constructor() {}
  send(signal?: AbortSignal) {
    return send(
      "ClearResearchCredentialsMessage",
      {},
      researchSettingsSchema,
      signal,
    );
  }
}
