import { useState, useRef, useEffect, useCallback } from "react";
import { ListBookmarksMessage } from "../../../apis/browser/ListBookmarksMessage";
import { SaveBookmarkMessage } from "../../../apis/browser/SaveBookmarkMessage";
import { RemoveBookmarkMessage } from "../../../apis/browser/RemoveBookmarkMessage";
import type { Bookmark } from "../../../shared/bookmark";
export function useBookmarks() {
  const [items, setItems] = useState<Bookmark[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mutation = useRef(false);
  const request = useRef<AbortController | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const c = new AbortController();
    request.current = c;
    setStatus((current) => (current === "ready" ? "ready" : "loading"));
    try {
      const result = await new ListBookmarksMessage().send(c.signal);
      if (!c.signal.aborted && mounted.current) {
        setItems(result.bookmarks);
        setStatus("ready");
        setError("");
      }
    } catch (e) {
      if (!c.signal.aborted && mounted.current) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "书签读取失败");
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("vibrowser.bookmarks");
      channel.current.onmessage = focus;
    }
    return () => {
      mounted.current = false;
      request.current?.abort();
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  const change = async (action: () => Promise<unknown>) => {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    request.current?.abort();
    try {
      await action();
      if (mounted.current) {
        channel.current?.postMessage("changed");
        await refresh();
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "书签保存失败");
    } finally {
      mutation.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const remove = (bookmarkId: string) =>
    change(() => new RemoveBookmarkMessage(bookmarkId).send());
  const toggle = (pageId: string, state?: Record<string, string>) => {
    const existing = items.find((item) => item.pageId === pageId);
    return existing
      ? remove(existing.id)
      : change(() => new SaveBookmarkMessage(pageId, state).send());
  };
  return { items, status, error, busy, refresh, remove, toggle };
}
