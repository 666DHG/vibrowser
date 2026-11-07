import { z } from "zod";
export const companionReplySchema = z.object({
  id: z.string(),
  status: z.enum(["queued", "running", "complete", "failed"]),
  text: z
    .string()
    .refine((value) => Array.from(value).length <= 40)
    .nullable(),
  expression: z.enum(["idle", "happy"]),
});

export type CompanionEvent = "navigate" | "success" | "click" | "bookmark";
export interface CompanionContext {
  event: CompanionEvent;
  input: string;
  title: string;
  mode: "imagination" | "research";
}
