import { useRef, useEffect, useCallback } from "react";
import { NavigateMessage } from "../../../apis/browser/NavigateMessage";
import { GetPageMessage } from "../../../apis/browser/GetPageMessage";
import { RetryPageMessage } from "../../../apis/browser/RetryPageMessage";
import {
  getBrowserSnapshot,
  getTab,
  setContent,
  setHistory,
  pushHistory,
  removeTab,
} from "../stores/browserStore";

export function useBrowserNavigation() {
  const controllers = useRef(new Map<string, AbortController>());
  const begin = (id: string) => {
    controllers.current.get(id)?.abort();
    const controller = new AbortController();
    controllers.current.set(id, controller);
    return controller;
  };
  const load = useCallback(
    async (tabId: string, pageId: string, c: AbortController) => {
      const deadline = Date.now() + 180000;
      while (!c.signal.aborted && getTab(tabId) && Date.now() < deadline) {
        const result = await new GetPageMessage(pageId).send(c.signal);
        if (c.signal.aborted || !getTab(tabId)) return;
        const page = result.page;
        if (!page) throw new Error("页面不存在");
        if (page.status === "ready" && page.spec) {
          setContent(tabId, { status: "ready", page });
          return;
        }
        if (page.status === "failed") {
          setContent(tabId, {
            status: "error",
            message: page.error ?? "生成失败",
            page,
          });
          return;
        }
        if (result.job)
          setContent(tabId, { status: "generating", page, job: result.job });
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
      if (!c.signal.aborted && getTab(tabId))
        throw new Error("等待时间较长，请刷新查看任务状态");
    },
    [],
  );
  const fail = (id: string, error: unknown, c: AbortController) => {
    if (!c.signal.aborted)
      setContent(id, {
        status: "error",
        message: error instanceof Error ? error.message : "请求失败",
      });
  };
  useEffect(() => {
    for (const tab of getBrowserSnapshot().tabs) {
      const entry = tab.entries[tab.index];
      if (tab.content.status === "loading" && entry) {
        const c = begin(tab.id);
        void load(tab.id, entry.pageId, c).catch((error) =>
          fail(tab.id, error, c),
        );
      }
    }
    const activeControllers = controllers.current;
    return () => {
      activeControllers.forEach((c) => c.abort());
      activeControllers.clear();
    };
  }, [load]);
  const activeId = () => getBrowserSnapshot().activeTabId;
  const navigate = async (
    input: string,
    referrerPageId?: string,
    tabId = activeId(),
  ) => {
    const c = begin(tabId);
    setContent(tabId, { status: "loading", input });
    try {
      const result = await new NavigateMessage(
        input,
        referrerPageId ?? null,
      ).send(c.signal);
      if (c.signal.aborted || !getTab(tabId)) return;
      pushHistory(tabId, { input, pageId: result.pageId, address: input });
      await load(tabId, result.pageId, c);
    } catch (error) {
      fail(tabId, error, c);
    }
  };
  const move = async (index: number) => {
    const tabId = activeId();
    const tab = getTab(tabId)!;
    const entry = tab.entries[index];
    if (!entry) return;
    const c = begin(tabId);
    setHistory(tabId, tab.entries, index);
    setContent(tabId, { status: "loading", input: entry.input });
    try {
      await load(tabId, entry.pageId, c);
    } catch (error) {
      fail(tabId, error, c);
    }
  };
  const retry = async (tabId = activeId()) => {
    const state = getTab(tabId)?.content;
    if (state?.status !== "error" || !state.page) return;
    const c = begin(tabId);
    setContent(tabId, { status: "loading", input: state.page.prompt });
    try {
      const result = await new RetryPageMessage(
        state.page.id,
        state.page.currentJobId,
      ).send(c.signal);
      if (!c.signal.aborted) await load(tabId, result.pageId, c);
    } catch (error) {
      fail(tabId, error, c);
    }
  };
  const home = () => {
    const id = activeId();
    begin(id);
    setContent(id, { status: "idle" });
  };
  const close = (id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    removeTab(id);
  };
  return { navigate, move, retry, home, close };
}
