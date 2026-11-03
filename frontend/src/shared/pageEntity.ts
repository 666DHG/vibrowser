import { z } from "zod";
export const entityPriceSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().min(1).max(12),
});
export const pageEntitySchema = z.object({
  id: z.string().max(2048),
  kind: z.enum(["thread", "article", "product", "page"]),
  title: z.string().trim().min(1).max(160),
  summary: z.string().max(6000).nullish(),
  author: z.string().max(160).nullish(),
  publishedAt: z.string().max(160).nullish(),
  replyCount: z.number().int().nonnegative().nullish(),
  price: entityPriceSchema.nullish(),
  legacyMeta: z.string().max(240).nullish(),
});
export const replyRangeSchema = z.object({
  from: z.number().int().min(1),
  to: z.number().int().min(1),
});
export type PageEntity = z.infer<typeof pageEntitySchema>;
export type ReplyRange = z.infer<typeof replyRangeSchema>;
