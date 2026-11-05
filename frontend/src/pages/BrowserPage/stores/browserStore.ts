import { displayAddress } from "../functions/displayAddress";
import { create } from "zustand";
import type {
  BrowserTab,
  BrowserSession,
  PendingNavigation,
  ContentState,
} from "../objects/BrowserState";
import type { PageRecord, Job } from "../../../shared/pageSpec";
import {
  restoreSession,
  persistSession,
  emptyTab,
} from "../functions/browserSession";
const store = create<BrowserSession>(() => restoreSession());
store.subscribe(persistSession);
export const useBrowserState = () => store();
export const getBrowserSnapshot = () => store.getState();
export const getTab = (id: string) =>
  store.getState().tabs.find((tab) => tab.id === id);
function updateTab(id: string, update: (tab: BrowserTab) => BrowserTab) {
  store.setState((state) => ({
    tabs: state.tabs.map((tab) => (tab.id === id ? update(tab) : tab)),
  }));
}
export const pageInput = (page: PageRecord) =>
  page.kind === "search" ? page.prompt : displayAddress(page.address);
export const visibleInput = (tab: BrowserTab) =>
  tab.content.status === "ready"
    ? pageInput(tab.content.page)
    : tab.content.status === "bookmarks"
      ? "vibrowser://bookmarks"
      : "";
export const setDraft = (id: string, draft: string) =>
  updateTab(id, (tab) => ({ ...tab, draft }));
export const setVisible = (id: string, content: ContentState) =>
  updateTab(id, (tab) => ({ ...tab, content }));
export function startNavigation(id: string, pending: PendingNavigation) {
  updateTab(id, (tab) => ({
    ...tab,
    pending,
    draft: displayAddress(pending.input),
    title: tab.content.status === "idle" ? pending.input : tab.title,
  }));
}
export function updatePending(
  id: string,
  requestId: string,
  change: Partial<PendingNavigation>,
) {
  updateTab(id, (tab) =>
    tab.pending?.requestId === requestId
      ? { ...tab, pending: { ...tab.pending, ...change } }
      : tab,
  );
}
export function completeNavigation(
  id: string,
  requestId: string,
  page: PageRecord,
  job?: Job,
) {
  updateTab(id, (tab) => {
    const pending = tab.pending;
    if (!pending || pending.requestId !== requestId) return tab;
    const entry = {
      state:
        pending.historyIndex !== undefined
          ? tab.entries[pending.historyIndex]?.state
          : undefined,
      scroll:
        pending.historyIndex !== undefined
          ? tab.entries[pending.historyIndex]?.scroll
          : undefined,
      input: pageInput(page),
      address: page.address,
      pageId: page.id,
    };
    const entries =
      tab.entries[tab.index]?.pageId === page.id
        ? tab.entries
        : [...tab.entries.slice(0, tab.index + 1), entry].slice(-100);
    const index =
      pending.historyIndex ??
      (entries === tab.entries ? tab.index : entries.length - 1);
    return {
      ...tab,
      entries:
        pending.historyIndex !== undefined
          ? tab.entries.map((old, i) =>
              i === pending.historyIndex ? entry : old,
            )
          : entries,
      index,
      title: page.document?.title ?? page.spec?.title ?? page.address,
      draft:
        tab.draft === displayAddress(pending.input)
          ? pageInput(page)
          : tab.draft,
      content: { status: "ready", page },
      pending: {
        ...pending,
        status: "complete",
        job,
        finishedAt: Date.now(),
        restoreEntry: undefined,
      },
    };
  });
}
export function dismissPending(id: string, requestId?: string) {
  updateTab(id, (tab) =>
    requestId && tab.pending?.requestId !== requestId
      ? tab
      : {
          ...tab,
          pending: null,
          draft:
            tab.pending?.status === "complete" ? tab.draft : visibleInput(tab),
          title: tab.content.status === "idle" ? "新标签页" : tab.title,
        },
  );
}
export function showHome(id: string) {
  updateTab(id, (tab) => ({
    ...tab,
    pending: null,
    content: { status: "idle" },
    draft: "",
    title: "新标签页",
  }));
}
export function addTab() {
  const tab = emptyTab();
  store.setState((state) => ({
    tabs: [...state.tabs, tab],
    activeTabId: tab.id,
  }));
  return tab.id;
}
export function openBookmarks() {
  const existing = store
    .getState()
    .tabs.find((tab) => tab.content.status === "bookmarks");
  if (existing) {
    selectTab(existing.id);
    return;
  }
  const id = addTab();
  updateTab(id, (tab) => ({
    ...tab,
    title: "书签",
    draft: "vibrowser://bookmarks",
    content: { status: "bookmarks" },
  }));
}
export function selectTab(id: string) {
  if (getTab(id)) store.setState({ activeTabId: id });
}
export function removeTab(id: string) {
  store.setState((state) => {
    const index = state.tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return state;
    const remaining = state.tabs.filter((tab) => tab.id !== id);
    const tabs = remaining.length ? remaining : [emptyTab()];
    return {
      tabs,
      activeTabId:
        state.activeTabId === id
          ? tabs[Math.min(index, tabs.length - 1)].id
          : state.activeTabId,
    };
  });
}

export function savePageState(
  id: string,
  state: Record<string, string>,
  scroll?: number,
) {
  updateTab(id, (tab) => ({
    ...tab,
    entries: tab.entries.map((entry, index) =>
      index === tab.index
        ? { ...entry, state, scroll: scroll ?? entry.scroll }
        : entry,
    ),
  }));
}
