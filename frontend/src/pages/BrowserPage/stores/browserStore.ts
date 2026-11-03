import { create } from "zustand";
import type {
  HistoryEntry,
  ContentState,
  BrowserTab,
  BrowserSession,
} from "../objects/BrowserState";
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
export const setDraft = (id: string, draft: string) =>
  updateTab(id, (tab) => ({ ...tab, draft }));
export function setContent(id: string, content: ContentState) {
  updateTab(id, (tab) => {
    const page =
      content.status === "ready" || content.status === "generating"
        ? content.page
        : null;
    const previousInput =
      tab.content.status === "loading"
        ? tab.content.input
        : tab.content.status === "generating" || tab.content.status === "ready"
          ? tab.content.page.kind === "search"
            ? tab.content.page.prompt
            : tab.content.page.address
          : tab.draft;
    const draft =
      page && tab.draft !== previousInput
        ? tab.draft
        : page
          ? page.kind === "search"
            ? page.prompt
            : page.address
          : content.status === "loading"
            ? content.input
            : content.status === "idle"
              ? ""
              : tab.draft;
    const title =
      content.status === "idle"
        ? "新标签页"
        : (page?.spec?.title ??
          (content.status === "loading" ? content.input : tab.title));
    return { ...tab, content, draft, title };
  });
}
export const setHistory = (
  id: string,
  entries: HistoryEntry[],
  index: number,
) => updateTab(id, (tab) => ({ ...tab, entries, index }));
export function pushHistory(id: string, entry: HistoryEntry) {
  updateTab(id, (tab) => {
    if (tab.entries[tab.index]?.pageId === entry.pageId) return tab;
    const entries = [...tab.entries.slice(0, tab.index + 1), entry].slice(-100);
    return { ...tab, entries, index: entries.length - 1 };
  });
}
export function addTab() {
  const tab = emptyTab();
  store.setState((state) => ({
    tabs: [...state.tabs, tab],
    activeTabId: tab.id,
  }));
  return tab.id;
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
