import { SubmitPageActionMessage } from "../../../apis/browser/SubmitPageActionMessage";
import type { WebAction } from "../../../shared/webDocument";
import { useRef, useEffect, useCallback } from "react";
import { NavigateMessage } from "../../../apis/browser/NavigateMessage";
import { GetPageMessage } from "../../../apis/browser/GetPageMessage";
import { RetryPageMessage } from "../../../apis/browser/RetryPageMessage";
import type { PendingNavigation } from "../objects/BrowserState";
import {
  getBrowserSnapshot,
  getTab,
  startNavigation,
  updatePending,
  completeNavigation,
  dismissPending,
  showHome,
  removeTab,
  addTab,
  setVisible,
  openBookmarks,
} from "../stores/browserStore";
export function useBrowserNavigation() {
  const controllers = useRef(new Map<string, AbortController>());
  const begin = (id: string) => {
    controllers.current.get(id)?.abort();
    const c = new AbortController();
    controllers.current.set(id, c);
    return c;
  };
  const fail = (
    id: string,
    token: string,
    error: unknown,
    c: AbortController,
  ) => {
    if (!c.signal.aborted)
      updatePending(id, token, {
        status: "error",
        message: error instanceof Error ? error.message : "请求失败",
        finishedAt: Date.now(),
      });
  };
  const load = useCallback(
    async (id: string, token: string, pageId: string, c: AbortController) => {
      const deadline = Date.now() + 180000;
      while (
        !c.signal.aborted &&
        getTab(id)?.pending?.requestId === token &&
        Date.now() < deadline
      ) {
        const result = await new GetPageMessage(pageId).send(c.signal);
        if (c.signal.aborted || getTab(id)?.pending?.requestId !== token)
          return;
        const page = result.page;
        if (!page) throw new Error("页面不存在");
        if (page.status === "ready" && (page.spec || page.document)) {
          const pending = getTab(id)?.pending;
          completeNavigation(
            id,
            token,
            page,
            pending?.cacheHit || pending?.mode === "cached"
              ? undefined
              : (result.job ?? undefined),
          );
          return;
        }
        if (page.status === "failed") {
          updatePending(id, token, {
            status: "error",
            failedPage: page,
            job: result.job ?? undefined,
            message: page.error ?? "生成失败",
            finishedAt: Date.now(),
          });
          return;
        }
        updatePending(id, token, {
          status: "generating",
          job: result.job ?? undefined,
        });
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
      if (!c.signal.aborted && getTab(id))
        throw new Error("等待时间较长，请重试查看任务状态");
    },
    [],
  );
  useEffect(() => {
    for (const tab of getBrowserSnapshot().tabs) {
      const pending = tab.pending;
      if (!pending || pending.status !== "loading") continue;
      const c = begin(tab.id);
      void (async () => {
        if (pending.restoreEntry) {
          const previous = await new GetPageMessage(
            pending.restoreEntry.pageId,
          ).send(c.signal);
          if (!c.signal.aborted && previous.page?.status === "ready")
            setVisible(tab.id, { status: "ready", page: previous.page });
        }
        if (pending.pageId)
          await load(tab.id, pending.requestId, pending.pageId, c);
        else throw new Error("上次请求尚未取得页面，请重试或取消本次打开");
      })().catch((error) => fail(tab.id, pending.requestId, error, c));
    }
    const active = controllers.current;
    return () => {
      active.forEach((c) => c.abort());
      active.clear();
    };
  }, [load]);
  const activeId = () => getBrowserSnapshot().activeTabId;
  const run = async (
    id: string,
    input: string,
    options: Partial<PendingNavigation> = {},
    retry = false,
  ) => {
    const c = begin(id);
    const pending: PendingNavigation = {
      ...options,
      requestId: crypto.randomUUID(),
      input,
      mode: options.mode ?? "navigate",
      status: "loading",
      startedAt: Date.now(),
      collapsed: false,
      finishedAt: undefined,
      message: undefined,
      job: undefined,
      cacheHit: undefined,
    };
    startNavigation(id, pending);
    try {
      let pageId = pending.pageId;
      if (retry && pending.failedPage && pending.mode !== "cached") {
        const result = await new RetryPageMessage(
          pending.failedPage.id,
          pending.failedPage.currentJobId,
        ).send(c.signal);
        pageId = result.pageId;
      } else if (!pageId) {
        if (pending.mode === "cached") throw new Error("保存的页面不可用");
        const a = pending.action;
        const result = a
          ? await new SubmitPageActionMessage(
              a.pageId,
              a.actionId,
              a.revision,
              a.requestId,
              a.values,
            ).send(c.signal)
          : await new NavigateMessage(
              input,
              pending.referrerPageId ?? null,
              pending.sourceBlockId ?? null,
            ).send(c.signal);
        pageId = result.pageId;
        if (!c.signal.aborted)
          updatePending(id, pending.requestId, {
            cacheHit: result.status === "ready",
          });
      }
      if (c.signal.aborted) return;
      updatePending(id, pending.requestId, { pageId, failedPage: undefined });
      await load(id, pending.requestId, pageId, c);
    } catch (error) {
      fail(id, pending.requestId, error, c);
    }
  };
  const navigate = (
    input: string,
    referrerPageId?: string,
    id = activeId(),
    sourceBlockId?: string,
  ) => {
    if (input.trim() === "vibrowser://bookmarks") {
      openBookmarks();
      return Promise.resolve();
    }
    return run(id, input, { referrerPageId, sourceBlockId });
  };
  const submitAction = (
    id: string,
    action: WebAction,
    values: Record<string, string>,
  ) => {
    const tab = getTab(id);
    if (!tab || tab.content.status !== "ready") return Promise.resolve();
    if (
      tab.pending?.action?.actionId === action.id &&
      ["loading", "generating"].includes(tab.pending.status)
    )
      return Promise.resolve();
    const page = tab.content.page;
    return run(
      id,
      action.kind === "Search"
        ? new URL(
            "/search?q=" + encodeURIComponent(values.q ?? ""),
            page.address,
          ).href
        : page.address,
      {
        historyIndex: action.kind === "Search" ? undefined : tab.index,
        action: {
          pageId: page.id,
          actionId: action.id,
          revision: page.currentJobId,
          requestId: crypto.randomUUID(),
          values,
        },
      },
    );
  };
  const move = (index: number) => {
    const id = activeId();
    const entry = getTab(id)?.entries[index];
    return entry
      ? run(id, entry.input, {
          mode: "cached",
          pageId: entry.pageId,
          historyIndex: index,
        })
      : Promise.resolve();
  };
  const refresh = () => {
    const tab = getTab(activeId());
    const entry = tab?.entries[tab.index];
    return entry
      ? run(tab!.id, entry.input, { historyIndex: tab!.index })
      : Promise.resolve();
  };
  const retry = (id = activeId()) => {
    const pending = getTab(id)?.pending;
    return pending ? run(id, pending.input, pending, true) : Promise.resolve();
  };
  const cancel = (id = activeId()) => {
    controllers.current.get(id)?.abort();
    dismissPending(id);
  };
  const home = () => {
    const id = activeId();
    cancel(id);
    showHome(id);
  };
  const close = (id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    removeTab(id);
  };
  const openSaved = (pageId: string, input: string) =>
    run(addTab(), input, { pageId, mode: "cached" });
  return {
    navigate,
    move,
    refresh,
    retry,
    cancel,
    home,
    close,
    openSaved,
    submitAction,
  };
}
