import { z } from "zod";
import type {
  BrowserTab,
  BrowserSession,
  PendingNavigation,
} from "../objects/BrowserState";
export const SESSION_KEY = "vibrowser.tabs.v2";
const entrySchema = z.object({
  input: z.string(),
  pageId: z.string(),
  address: z.string(),
});
const historySchema = z.object({
  entries: z.array(entrySchema).max(100),
  index: z.number().int(),
});
const pendingSchema = z.object({
  input: z.string(),
  mode: z.enum(["navigate", "cached"]),
  pageId: z.string().optional(),
  referrerPageId: z.string().optional(),
  sourceBlockId: z.string().optional(),
  historyIndex: z.number().int().optional(),
});
const sessionSchema = z.object({
  activeTabId: z.string(),
  tabs: z
    .array(
      historySchema.extend({
        id: z.string(),
        title: z.string(),
        draft: z.string(),
        home: z.boolean().optional(),
        view: z.enum(["idle", "ready", "bookmarks"]).optional(),
        pending: pendingSchema.nullable().optional(),
      }),
    )
    .min(1),
});
export function emptyTab(): BrowserTab {
  return {
    id: crypto.randomUUID(),
    title: "新标签页",
    draft: "",
    entries: [],
    index: -1,
    content: { status: "idle" },
    pending: null,
  };
}
export function restoreSession(): BrowserSession {
  try {
    const stored =
      sessionStorage.getItem(SESSION_KEY) ??
      sessionStorage.getItem("vibrowser.tabs.v1");
    if (stored) {
      const parsed = sessionSchema.parse(JSON.parse(stored));
      if (new Set(parsed.tabs.map((tab) => tab.id)).size !== parsed.tabs.length)
        throw new Error("Duplicate tabs");
      const tabs: BrowserTab[] = parsed.tabs.map(
        ({ home, view, pending, ...tab }) => {
          const entry = tab.entries[tab.index];
          const kind = view ?? (home ? "idle" : "ready");
          const target =
            pending ??
            (kind === "ready" && entry
              ? {
                  input: entry.input,
                  pageId: entry.pageId,
                  mode: "cached" as const,
                  historyIndex: tab.index,
                }
              : null);
          const navigation: PendingNavigation | null = target
            ? {
                ...target,
                requestId: crypto.randomUUID(),
                status: "loading",
                startedAt: Date.now(),
                collapsed: false,
                restoreEntry: pending && kind === "ready" ? entry : undefined,
              }
            : null;
          return {
            ...tab,
            index: entry ? tab.index : -1,
            content: { status: kind === "bookmarks" ? "bookmarks" : "idle" },
            pending: navigation,
          };
        },
      );
      return {
        tabs,
        activeTabId: tabs.some((tab) => tab.id === parsed.activeTabId)
          ? parsed.activeTabId
          : tabs[0].id,
      };
    }
    const legacy = localStorage.getItem("vibrowser.history.v1");
    if (legacy) {
      const history = historySchema.parse(JSON.parse(legacy));
      const entry = history.entries[history.index];
      if (entry) {
        const tab: BrowserTab = {
          ...emptyTab(),
          ...history,
          title: entry.input,
          draft: entry.input,
          pending: {
            requestId: crypto.randomUUID(),
            input: entry.input,
            pageId: entry.pageId,
            historyIndex: history.index,
            mode: "cached",
            status: "loading",
            startedAt: Date.now(),
            collapsed: false,
          },
        };
        const session = { tabs: [tab], activeTabId: tab.id };
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify(savedSession(session)),
        );
        localStorage.removeItem("vibrowser.history.v1");
        return session;
      }
    }
  } catch {
    /* Unavailable storage must not prevent navigation. */
  }
  const tab = emptyTab();
  return { tabs: [tab], activeTabId: tab.id };
}
function savedSession(session: BrowserSession) {
  return {
    activeTabId: session.activeTabId,
    tabs: session.tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      draft: tab.draft,
      entries: tab.entries,
      index: tab.index,
      view: tab.content.status,
      pending:
        tab.pending && tab.pending.status !== "complete"
          ? {
              input: tab.pending.input,
              mode: tab.pending.mode,
              pageId: tab.pending.pageId,
              referrerPageId: tab.pending.referrerPageId,
              sourceBlockId: tab.pending.sourceBlockId,
              historyIndex: tab.pending.historyIndex,
            }
          : null,
    })),
  };
}
export function persistSession(session: BrowserSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(savedSession(session)));
  } catch {
    /* Continue in memory if storage is unavailable. */
  }
}
