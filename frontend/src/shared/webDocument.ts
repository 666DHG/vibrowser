import { z } from "zod";
import { pageEntitySchema } from "./pageEntity";
export const webActionSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "Navigate",
    "Search",
    "Submit",
    "Replace",
    "Append",
    "Toggle",
    "Switch",
    "Filter",
    "Sort",
    "Set",
    "Increment",
    "Copy",
  ]),
  elementId: z.string(),
  target: z.string().nullish(),
  region: z.string().nullish(),
  stateKey: z.string().nullish(),
  value: z.string().nullish(),
  field: z.string().nullish(),
});
export const webDocumentSchema = z.object({
  schemaVersion: z.literal(3),
  title: z.string(),
  description: z.string(),
  html: z.string(),
  css: z.string(),
  siteStyle: z.object({
    brand: z.string(),
    typography: z.string(),
    palette: z.string(),
    layout: z.string(),
  }),
  entities: z.array(pageEntitySchema),
  bindings: z.array(
    z.object({
      elementId: z.string(),
      entityId: z.string(),
      field: z.enum([
        "Title",
        "Summary",
        "Author",
        "PublishedAt",
        "ReplyCount",
        "Price",
        "LegacyMeta",
      ]),
    }),
  ),
  actions: z.array(webActionSchema),
  initialState: z.record(z.string(), z.string()),
  persistentKeys: z.array(z.string()),
  subjectEntityId: z.string().nullish(),
});
export type WebDocument = z.infer<typeof webDocumentSchema>;
export type WebAction = z.infer<typeof webActionSchema>;
