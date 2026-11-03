import { z } from "zod";
export const blockTypes = [
  "navbar",
  "hero",
  "text",
  "card",
  "grid",
  "button",
  "footer",
  "results",
  "ascii",
] as const;
export type BlockType = (typeof blockTypes)[number];
export interface PageBlock {
  id: string;
  type: BlockType;
  title: string | null;
  text: string | null;
  target: string | null;
  items: PageBlock[];
}
const blockSchema: z.ZodType<PageBlock> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(80),
    type: z.enum(blockTypes),
    title: z.string().max(160).nullable(),
    text: z.string().max(6000).nullable(),
    target: z.string().max(2048).nullable(),
    items: z.array(blockSchema).max(12),
  }),
);
export const pageSpecSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().trim().min(1).max(160),
    description: z.string().max(500),
    theme: z.enum(["paper", "midnight", "terminal", "coral"]),
    blocks: z.array(blockSchema).min(1).max(12),
  })
  .superRefine((page, ctx) => {
    const ids = new Set<string>();
    let count = 0;
    function visit(block: PageBlock, depth: number) {
      count++;
      if (ids.has(block.id) || depth > 3)
        ctx.addIssue({ code: "custom", message: "重复组件 ID 或嵌套过深" });
      ids.add(block.id);
      if (
        block.items.length &&
        !["navbar", "grid", "results"].includes(block.type)
      )
        ctx.addIssue({ code: "custom", message: "组件不允许子项" });
      if (["button", "card"].includes(block.type) && !block.title?.trim())
        ctx.addIssue({ code: "custom", message: "缺少标题" });
      if (block.type === "button" && !block.target)
        ctx.addIssue({ code: "custom", message: "按钮缺少链接" });
      if (block.target && !safeTarget(block.target))
        ctx.addIssue({ code: "custom", message: "链接无效" });
      block.items.forEach((child) => visit(child, depth + 1));
    }
    page.blocks.forEach((block) => visit(block, 1));
    if (count > 12) ctx.addIssue({ code: "custom", message: "组件总数超过12" });
  });
export type PageSpec = z.infer<typeof pageSpecSchema>;
export function safeTarget(target: string): boolean {
  try {
    if (target.length > 2048 || /[\\\u0000-\u001f]/.test(target)) return false;
    const url = new URL(target, "https://vibe.example/");
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.hostname.includes(".") &&
      !url.hostname.endsWith(".local") &&
      !url.hostname.endsWith(".localhost") &&
      !/^[\d.]+$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}
export const pageRecordSchema = z.object({
  id: z.string(),
  address: z.string(),
  kind: z.enum(["website", "search"]),
  prompt: z.string(),
  status: z.enum(["generating", "ready", "failed"]),
  spec: pageSpecSchema.nullable(),
  currentJobId: z.string(),
  referrerId: z.string().nullable(),
  error: z.string().nullable(),
  source: z.string(),
});
export const jobSchema = z.object({
  id: z.string(),
  pageId: z.string().nullable(),
  kind: z.enum(["page", "connection"]),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  phase: z.string(),
  error: z.string().nullable(),
  settingsRevision: z.number(),
});
export const responseSchema = z.object({
  page: pageRecordSchema.nullable(),
  job: jobSchema.nullable(),
});
export const navigationSchema = z.object({
  pageId: z.string(),
  jobId: z.string(),
  status: z.enum(["generating", "ready", "failed"]),
});
export const settingsSchema = z.object({
  baseUrl: z.string(),
  model: z.string(),
  hasKey: z.boolean(),
  revision: z.number(),
});
export type PageRecord = z.infer<typeof pageRecordSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Settings = z.infer<typeof settingsSchema>;
