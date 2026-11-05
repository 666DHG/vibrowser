import { z } from "zod";
export const researchSettingsSchema = z.object({
  reuseGenerationKey: z.boolean(),
  hasKey: z.boolean(),
  canReuseGenerationKey: z.boolean(),
  revision: z.number(),
});
export const researchCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  sourceIds: z.array(z.string()),
});
export const researchSummarySchema = z.object({
  sourceCount: z.number(),
  candidates: z.array(researchCandidateSchema),
  selectedCandidateId: z.string().nullable(),
});
export const researchSourcesSchema = z.object({
  sources: z.array(
    z.object({
      id: z.string(),
      url: z.string().url(),
      title: z.string(),
      retrievedAt: z.string(),
      excerpt: z.string(),
    }),
  ),
});
export type ResearchCandidate = z.infer<typeof researchCandidateSchema>;
