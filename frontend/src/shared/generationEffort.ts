import { z } from "zod";
export const generationEffortSchema = z.enum(["standard", "deep"]);
export type GenerationEffort = z.infer<typeof generationEffortSchema>;
