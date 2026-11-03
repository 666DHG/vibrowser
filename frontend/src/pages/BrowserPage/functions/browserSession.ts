import { z } from "zod";
import type { BrowserTab, BrowserSession } from "../objects/BrowserState";

export const SESSION_KEY = "vibrowser.tabs.v1";
const historySchema = z.object({
  entries: z
    .array(
      z.object({ input: z.string(), pageId: z.string(), address: z.string() }),
    )
    .max(100),
  index: z.number().int(),
});
const sessionSchema = z.object({
  activeTabId: z.string(),
  tabs: z
    .array(
      historySchema.extend({
        id: z.string(),
        title: z.string(),
        draft: z.string(),
        home: z.boolean(),
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
  };
}
export function restoreSession(): BrowserSession {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = sessionSchema.parse(JSON.parse(stored));
      if (new Set(parsed.tabs.map((tab) => tab.id)).size !== parsed.tabs.length)
        throw new Error("Duplicate tabs");
      const tabs: BrowserTab[] = parsed.tabs.map(({ home, ...tab }) => {
        const entry = tab.entries[tab.index];
        return {
          ...tab,
          index: entry ? tab.index : -1,
          content:
            !home && entry
              ? { status: "loading", input: entry.input }
              : { status: "idle" },
        };
      });
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
          content: { status: "loading", input: entry.input },
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
    /* Storage may be unavailable or contain an obsolete session. */
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
      home: tab.content.status === "idle",
    })),
  };
}
export function persistSession(session: BrowserSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(savedSession(session)));
  } catch {
    /* Navigation still works when storage is unavailable. */
  }
}
