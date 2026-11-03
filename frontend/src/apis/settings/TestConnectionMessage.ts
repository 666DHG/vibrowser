import { z } from "zod";
import { send } from "../system/send";
export class TestConnectionMessage {
  send(signal?: AbortSignal) {
    return send(
      "TestConnectionMessage",
      {},
      z.object({ jobId: z.string() }),
      signal,
    );
  }
}
