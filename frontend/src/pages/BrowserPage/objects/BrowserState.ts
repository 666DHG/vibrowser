import type { PageRecord, Job } from "../../../shared/pageSpec";
export interface HistoryEntry {
  input: string;
  pageId: string;
  address: string;
}
export type ContentState =
  | { status: "idle" }
  | { status: "loading"; input: string }
  | { status: "generating"; page: PageRecord; job: Job }
  | { status: "ready"; page: PageRecord }
  | { status: "error"; message: string; page?: PageRecord };
