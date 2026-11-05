import { webDocumentSchema } from "./webDocument";
import {
  pageEntitySchema,
  replyRangeSchema,
  type ReplyRange,
} from "./pageEntity";
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
  "section",
  "list",
  "article",
  "product",
  "thread",
  "stat",
  "quote",
  "code",
  "divider",
] as const;
export const PAGE_LIMITS = { blocks: 48, depth: 4 } as const;
export const pageDesignSchema = z.object({
  layout: z
    .enum([
      "classic",
      "editorial",
      "storefront",
      "documentation",
      "community",
      "dashboard",
      "studio",
      "directory",
    ])
    .default("classic"),
  typography: z.enum(["sans", "serif", "mono", "display"]).default("sans"),
  density: z.enum(["compact", "comfortable", "airy"]).default("comfortable"),
  accent: z
    .enum(["blue", "red", "green", "amber", "violet", "neutral"])
    .default("blue"),
});
export type PageDesign = z.infer<typeof pageDesignSchema>;
export const blockStyleSchema = z.object({
  variant: z.enum(["plain", "feature", "outline", "muted"]).default("plain"),
  placement: z.enum(["auto", "main", "aside", "full"]).default("auto"),
  columns: z.number().int().min(1).max(4).nullish(),
});
export type BlockStyle = z.infer<typeof blockStyleSchema>;
export type BlockType = (typeof blockTypes)[number];
export interface PageBlock {
  id: string;
  type: BlockType;
  title: string | null;
  text: string | null;
  target: string | null;
  items: PageBlock[];
  meta?: string | null;
  style?: BlockStyle | null;
  entityId?: string | null;
  replyRange?: ReplyRange | null;
}
const blockSchema: z.ZodType<PageBlock> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(80),
    type: z.enum(blockTypes),
    title: z.string().max(160).nullable(),
    text: z.string().max(6000).nullable(),
    target: z.string().max(2048).nullable(),
    items: z.array(blockSchema).max(PAGE_LIMITS.blocks),
    meta: z.string().max(240).nullish(),
    style: blockStyleSchema.nullish(),
    entityId: z.string().max(2048).nullish(),
    replyRange: replyRangeSchema.nullish(),
  }),
);
export const pageSpecSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    title: z.string().trim().min(1).max(160),
    description: z.string().max(500),
    theme: z.enum([
      "paper",
      "midnight",
      "terminal",
      "coral",
      "white",
      "graphite",
      "sage",
    ]),
    design: pageDesignSchema.nullish(),
    entities: z.array(pageEntitySchema).max(48).default([]),
    subjectEntityId: z.string().nullish(),
    blocks: z.array(blockSchema).min(1).max(PAGE_LIMITS.blocks),
  })
  .superRefine((page, ctx) => {
    const entities = new Map(
      page.entities.map((entity) => [entity.id, entity]),
    );
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (entities.size !== page.entities.length) issue("实体标识重复");
    if (
      page.schemaVersion === 1 &&
      (page.entities.length || page.subjectEntityId)
    )
      issue("实体需要版本2");
    for (const entity of page.entities) {
      if (
        !/^https?:\/\//.test(entity.id) ||
        !safeTarget(entity.id) ||
        new URL(entity.id).href !== entity.id ||
        new URL(entity.id).hash
      )
        issue("实体地址无效");
    }
    if (page.subjectEntityId && !entities.has(page.subjectEntityId))
      issue("主体实体不存在");
    let subjectVisible = false;
    const ids = new Set<string>();
    let count = 0;
    function visit(block: PageBlock, depth: number) {
      count++;
      const entity = block.entityId ? entities.get(block.entityId) : undefined;
      if (block.entityId && (!entity || page.schemaVersion !== 2))
        issue("实体引用不存在");
      if (
        page.schemaVersion === 2 &&
        block.target &&
        ["article", "thread", "product"].includes(block.type) &&
        !entity
      )
        issue("条目缺少实体引用");
      if (
        entity &&
        block.target &&
        /^https?:\/\//.test(block.target) &&
        new URL(block.target).href.split("#")[0] !== entity.id
      )
        issue("链接与实体不匹配");
      if (block.entityId === page.subjectEntityId && !block.replyRange)
        subjectVisible = true;
      const range = block.replyRange;
      if (
        range &&
        (range.to < range.from ||
          entity?.replyCount == null ||
          range.to > entity.replyCount ||
          block.items.length !== range.to - range.from + 1)
      )
        issue("回复范围无效");
      if (ids.has(block.id) || depth > PAGE_LIMITS.depth)
        ctx.addIssue({ code: "custom", message: "重复组件 ID 或嵌套过深" });
      ids.add(block.id);
      if (
        block.items.length &&
        !["navbar", "grid", "results", "section", "list"].includes(block.type)
      )
        ctx.addIssue({ code: "custom", message: "组件不允许子项" });
      if (
        ["button", "card", "article", "product", "thread", "stat"].includes(
          block.type,
        ) &&
        !block.title?.trim() &&
        !entity
      )
        ctx.addIssue({ code: "custom", message: "缺少标题" });
      if (block.type === "button" && !block.target)
        ctx.addIssue({ code: "custom", message: "按钮缺少链接" });
      if (["quote", "code"].includes(block.type) && !block.text?.trim())
        ctx.addIssue({ code: "custom", message: "组件需要正文" });
      if (block.target && !safeTarget(block.target))
        ctx.addIssue({ code: "custom", message: "链接无效" });
      block.items.forEach((child) => visit(child, depth + 1));
    }
    page.blocks.forEach((block) => visit(block, 1));
    if (page.subjectEntityId && !subjectVisible) issue("主体实体未展示");
    if (count > PAGE_LIMITS.blocks)
      ctx.addIssue({ code: "custom", message: "组件总数超过48" });
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
  document: webDocumentSchema.nullish(),
  currentJobId: z.string(),
  referrerId: z.string().nullable(),
  error: z.string().nullable(),
  source: z.string(),
});
export const generationStepSchema = z.object({
  phase: z.enum([
    "queued",
    "preparing",
    "generating",
    "validating",
    "repairing",
    "retrying",
    "saving",
    "ready",
    "failed",
  ]),
  attempt: z.number().int().min(1),
  at: z.string(),
});
export type GenerationStep = z.infer<typeof generationStepSchema>;
export const jobSchema = z.object({
  id: z.string(),
  pageId: z.string().nullable(),
  kind: z.enum(["page", "connection", "action"]),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  phase: z.string(),
  error: z.string().nullable(),
  settingsRevision: z.number(),
  steps: z.array(generationStepSchema).default([]),
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
