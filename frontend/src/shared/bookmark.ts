import { z } from "zod";
export const bookmarkSchema = z.object({
  id: z.string(),
  pageId: z.string(),
  title: z.string(),
  address: z.string(),
  kind: z.enum(["website", "search"]),
  savedAt: z.string(),
});
export const bookmarkListSchema = z.object({
  bookmarks: z.array(bookmarkSchema),
});
export const bookmarkRemovalSchema = z.object({ removed: z.boolean() });
export type Bookmark = z.infer<typeof bookmarkSchema>;
