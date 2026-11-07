import { useEffect, useRef, useState } from "react";
import type { BrowserTab } from "../objects/BrowserState";
import type {
  CompanionEvent,
  CompanionPreferences,
  CatExpression,
} from "../objects/CompanionState";
import { canSpeak } from "../functions/companionRules";
import { RequestCompanionReplyMessage } from "../../../apis/companion/RequestCompanionReplyMessage";
import { GetCompanionReplyMessage } from "../../../apis/companion/GetCompanionReplyMessage";
import { GetSettingsMessage } from "../../../apis/settings/GetSettingsMessage";
export function useCompanion(
  tab: BrowserTab,
  preferences: CompanionPreferences,
  saved: boolean,
  mock: boolean,
) {
  const [speech, setSpeech] = useState<{
    text: string;
    expression: CatExpression;
    expires: number;
  } | null>(null);
  const lastAutomatic = useRef(-Infinity),
    lastClick = useRef(-Infinity),
    lastAI = useRef(-Infinity);
  const request = useRef<AbortController | null>(null);
  const previous = useRef({
    tabId: tab.id,
    pending: tab.pending?.requestId,
    status: tab.pending?.status,
    saved,
    pageId: tab.content.status === "ready" ? tab.content.page.id : "",
  });
  const latest = useRef({ tab, preferences });
  latest.current = { tab, preferences };
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setSpeech(null);
  };
  useEffect(() => {
    cancel();
    return () => request.current?.abort();
  }, [
    tab.id,
    tab.pending?.requestId,
    preferences.visible,
    preferences.ai,
    preferences.automatic,
  ]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    if (!speech) return;
    const timer = setTimeout(
      () => setSpeech(null),
      Math.max(0, speech.expires - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [speech]);
  const speak = (event: CompanionEvent) => {
    const now = Date.now(),
      automatic = event !== "click";
    if (
      !preferences.visible ||
      document.hidden ||
      tab.pending ||
      (automatic && !preferences.automatic)
    )
      return;
    const last = automatic ? lastAutomatic : lastClick;
    if (!canSpeak(now, last.current, automatic)) return;
    last.current = now;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const expires = now + 6000;
    const lines =
      event === "bookmark"
        ? ["这条线索收好啦。", "喜欢的地方，就留个爪印。"]
        : event === "click"
          ? [
              "喵？我在这里陪你呢。",
              "耳朵竖好了，下一站去哪？",
              "再摸一下，就陪你再逛一页。",
            ]
          : ["新的世界，值得慢慢看看。", "我的好奇心已经竖起耳朵了。"];
    setSpeech({
      text: lines[Math.floor(Math.random() * lines.length)],
      expression: event === "click" ? "petted" : "happy",
      expires,
    });
    if (!preferences.ai || now - lastAI.current < 120000) return;
    lastAI.current = now;
    const current = () =>
      !controller.signal.aborted &&
      !document.hidden &&
      Date.now() < expires &&
      latest.current.tab.id === tab.id &&
      !latest.current.tab.pending &&
      latest.current.preferences.visible &&
      latest.current.preferences.ai;
    void (async () => {
      const settings = await new GetSettingsMessage().send(controller.signal);
      if (!current() || (!settings.hasKey && !mock)) return;
      const page = tab.content.status === "ready" ? tab.content.page : null;
      let result = await new RequestCompanionReplyMessage({
        event,
        input: (tab.entries[tab.index]?.input ?? "").slice(0, 200),
        title: tab.title.slice(0, 100),
        mode: page?.mode ?? tab.browsingMode ?? "imagination",
      }).send(controller.signal);
      while (
        current() &&
        (result.status === "queued" || result.status === "running")
      ) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", finish);
            resolve();
          };
          const timer = setTimeout(finish, 350);
          controller.signal.addEventListener("abort", finish, { once: true });
        });
        if (!current()) return;
        result = await new GetCompanionReplyMessage(result.id).send(
          controller.signal,
        );
      }
      if (current() && result.status === "complete" && result.text)
        setSpeech({ text: result.text, expression: "happy", expires });
    })().catch(() => {
      /* Local speech remains available. */
    });
  };
  useEffect(() => {
    const pageId = tab.content.status === "ready" ? tab.content.page.id : "";
    const before = previous.current;
    previous.current = {
      tabId: tab.id,
      pending: tab.pending?.requestId,
      status: tab.pending?.status,
      saved,
      pageId,
    };
    if (before.tabId !== tab.id) return;
    if (tab.pending) {
      cancel();
      return;
    }
    if (saved && !before.saved && pageId === before.pageId) speak("bookmark");
    else if (
      before.pending &&
      before.status === "complete" &&
      tab.content.status === "ready"
    )
      speak("success");
  }, [tab.id, tab.pending, saved]);
  return { speech, speak, dismiss: cancel };
}
