import { z } from "zod";
import { send } from "../system/send";
export class ClearCredentialsMessage {
  send(signal?: AbortSignal) {
    return send(
      "ClearCredentialsMessage",
      {},
      z.object({ cleared: z.boolean() }),
      signal,
    );
  }
}
