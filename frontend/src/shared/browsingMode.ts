import { z } from "zod";
export const browsingModeSchema = z.enum(["imagination", "research"]);
export type BrowsingMode = z.infer<typeof browsingModeSchema>;
