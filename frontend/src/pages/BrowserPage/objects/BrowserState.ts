import type { PageRecord, Job } from "../../../shared/pageSpec";
export interface HistoryEntry {
  state?: Record<string, string>;
  scroll?: number;
  input: string;
  pageId: string;
  address: string;
}
export type ContentState =
  | { status: "idle" }
  | { status: "bookmarks" }
  | { status: "ready"; page: PageRecord };
export interface PendingNavigation {
  requestId: string;
  input: string;
  mode: "navigate" | "cached";
  status: "loading" | "generating" | "error" | "complete";
  startedAt: number;
  finishedAt?: number;
  pageId?: string;
  referrerPageId?: string;
  sourceBlockId?: string;
  historyIndex?: number;
  job?: Job;
  failedPage?: PageRecord;
  message?: string;
  collapsed: boolean;
  cacheHit?: boolean;
  restoreEntry?: HistoryEntry;
  action?: {
    pageId: string;
    actionId: string;
    revision: string;
    requestId: string;
    values: Record<string, string>;
  };
}
export interface BrowserTab {
  id: string;
  title: string;
  draft: string;
  entries: HistoryEntry[];
  index: number;
  content: ContentState;
  pending: PendingNavigation | null;
}
export interface BrowserSession {
  tabs: BrowserTab[];
  activeTabId: string;
}
