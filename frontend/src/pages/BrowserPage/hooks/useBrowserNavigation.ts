import { useRef, useEffect, useCallback } from "react";
import { NavigateMessage } from "../../../apis/browser/NavigateMessage";
import { GetPageMessage } from "../../../apis/browser/GetPageMessage";
import { RetryPageMessage } from "../../../apis/browser/RetryPageMessage";
import {
  getBrowserSnapshot,
  setContent,
  setHistory,
  pushHistory,
} from "../stores/browserStore";
export function useBrowserNavigation() {
  const controller = useRef<AbortController | null>(null);
  const begin = () => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    return c;
  };
  useEffect(() => () => controller.current?.abort(), []);
  const load = useCallback(async (id: string, c: AbortController) => {
    const deadline = Date.now() + 180000;
    while (!c.signal.aborted && Date.now() < deadline) {
      const result = await new GetPageMessage(id).send(c.signal);
      if (c.signal.aborted) return;
      const page = result.page;
      if (!page) throw new Error("页面不存在");
      if (page.status === "ready" && page.spec) {
        setContent({ status: "ready", page });
        return;
      }
      if (page.status === "failed") {
        setContent({
          status: "error",
          message: page.error ?? "生成失败",
          page,
        });
        return;
      }
      if (result.job)
        setContent({ status: "generating", page, job: result.job });
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          c.signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, 700);
        c.signal.addEventListener("abort", finish, { once: true });
      });
    }
    if (!c.signal.aborted) throw new Error("等待时间较长，请刷新查看任务状态");
  }, []);
  const fail = (e: unknown, c: AbortController) => {
    if (!c.signal.aborted)
      setContent({
        status: "error",
        message: e instanceof Error ? e.message : "请求失败",
      });
  };
  const navigate = async (input: string, referrerPageId?: string) => {
    const c = begin();
    setContent({ status: "loading", input });
    try {
      const result = await new NavigateMessage(
        input,
        referrerPageId ?? null,
      ).send(c.signal);
      if (c.signal.aborted) return;
      pushHistory({ input, pageId: result.pageId, address: input });
      await load(result.pageId, c);
    } catch (e) {
      fail(e, c);
    }
  };
  const move = async (index: number) => {
    const snapshot = getBrowserSnapshot();
    const entry = snapshot.entries[index];
    if (!entry) return;
    const c = begin();
    setHistory(snapshot.entries, index);
    setContent({ status: "loading", input: entry.input });
    try {
      await load(entry.pageId, c);
    } catch (e) {
      fail(e, c);
    }
  };
  const retry = async () => {
    const state = getBrowserSnapshot().content;
    if (state.status !== "error" || !state.page) return;
    const c = begin();
    setContent({ status: "loading", input: state.page.prompt });
    try {
      const result = await new RetryPageMessage(
        state.page.id,
        state.page.currentJobId,
      ).send(c.signal);
      await load(result.pageId, c);
    } catch (e) {
      fail(e, c);
    }
  };
  const home = () => {
    begin();
    setContent({ status: "idle" });
  };
  return { navigate, move, retry, home };
}
