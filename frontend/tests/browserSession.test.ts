import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  emptyTab,
  persistSession,
  restoreSession,
  SESSION_KEY,
} from "../src/pages/BrowserPage/functions/browserSession";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
beforeEach(() => {
  vi.stubGlobal("sessionStorage", memoryStorage());
  vi.stubGlobal("localStorage", memoryStorage());
});
afterEach(() => vi.unstubAllGlobals());

it("restores home and an unsubmitted draft while preserving that tab's history", () => {
  const tab = {
    ...emptyTab(),
    draft: "下一站",
    entries: [
      { input: "site.example", pageId: "page-1", address: "site.example" },
    ],
    index: 0,
  };
  persistSession({ tabs: [tab], activeTabId: tab.id });
  const restored = restoreSession();
  expect(restored.tabs[0].content.status).toBe("idle");
  expect(restored.tabs[0].draft).toBe("下一站");
  expect(restored.tabs[0].entries).toEqual(tab.entries);
  expect(
    JSON.parse(sessionStorage.getItem(SESSION_KEY)!).tabs[0],
  ).not.toHaveProperty("content");
});

it("migrates the original single history once without copying it to every new window", () => {
  localStorage.setItem(
    "vibrowser.history.v1",
    JSON.stringify({
      entries: [
        { input: "old.example", pageId: "old-page", address: "old.example" },
      ],
      index: 0,
    }),
  );
  const restored = restoreSession();
  expect(restored.tabs[0].pending).toMatchObject({
    status: "loading",
    input: "old.example",
  });
  expect(localStorage.getItem("vibrowser.history.v1")).toBeNull();
  expect(restoreSession().activeTabId).toBe(restored.activeTabId);
});

it("repairs missing active IDs and invalid history indexes and rejects duplicate tabs", () => {
  const tab = {
    id: "tab-1",
    title: "site",
    draft: "draft",
    entries: [],
    index: 9,
    home: false,
  };
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ tabs: [tab], activeTabId: "missing" }),
  );
  const restored = restoreSession();
  expect(restored.activeTabId).toBe("tab-1");
  expect(restored.tabs[0].index).toBe(-1);
  expect(restored.tabs[0].content.status).toBe("idle");
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ tabs: [tab, tab], activeTabId: "tab-1" }),
  );
  expect(restoreSession().tabs).toHaveLength(1);
  expect(restoreSession().activeTabId).not.toBe("tab-1");
});

it("unavailable storage still permits an in-memory session", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => {
      throw new Error("Blocked");
    },
    setItem: () => {
      throw new Error("Full");
    },
  });
  const restored = restoreSession();
  expect(restored.tabs[0].content.status).toBe("idle");
  expect(() => persistSession(restored)).not.toThrow();
});
