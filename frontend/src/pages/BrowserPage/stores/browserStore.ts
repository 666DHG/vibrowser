import { create } from "zustand";
import type { HistoryEntry, ContentState } from "../objects/BrowserState";
interface State {
  entries: HistoryEntry[];
  index: number;
  content: ContentState;
}
const store = create<State>(() => ({
  entries: [],
  index: -1,
  content: { status: "idle" },
}));
export const useBrowserState = () => store();
export const getBrowserSnapshot = () => store.getState();
export const setContent = (content: ContentState) =>
  store.setState({ content });
export const setHistory = (entries: HistoryEntry[], index: number) =>
  store.setState({ entries, index });
export function pushHistory(entry: HistoryEntry) {
  const { entries, index } = store.getState();
  if (entries[index]?.pageId === entry.pageId) return;
  const next = [...entries.slice(0, index + 1), entry].slice(-100);
  setHistory(next, next.length - 1);
}
