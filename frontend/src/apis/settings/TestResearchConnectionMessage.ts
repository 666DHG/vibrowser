import { send } from "../system/send";
import { z } from "zod";
export class TestResearchConnectionMessage {
  constructor() {}
  send(signal?: AbortSignal) {
    return send(
      "TestResearchConnectionMessage",
      {},
      z.object({ jobId: z.string() }),
      signal,
    );
  }
}
