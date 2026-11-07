import { useCallback, useEffect, useState } from "react";
import type { BrowserTab } from "../objects/BrowserState";
import { dismissPending } from "../stores/browserStore";
import {
  useCompanionPreferences,
  listenCompanionPreferences,
} from "../stores/companionStore";
import { useCompanion } from "../hooks/useCompanion";
import { companionProgress } from "../functions/companionRules";
import { NavigationProgress } from "./NavigationProgress";
export function BrowserCompanion({
  tab,
  saved,
  mock,
  onRetry,
  onCancel,
  onSettings,
  onSelectCandidate,
}: {
  tab: BrowserTab;
  saved: boolean;
  mock: boolean;
  onRetry: () => void;
  onCancel: () => void;
  onSettings: () => void;
  onSelectCandidate: (id: string) => void;
}) {
  const preferences = useCompanionPreferences();
  const { speech, speak, dismiss } = useCompanion(
    tab,
    preferences,
    saved,
    mock,
  );
  const [expanded, setExpanded] = useState(false);
  useEffect(listenCompanionPreferences, []);
  useEffect(() => setExpanded(false), [tab.id, tab.pending?.requestId]);
  const pending = tab.pending;
  const forced =
    pending?.status === "error" || !!pending?.researchCandidates?.length;
  const open = expanded || forced;
  const onDismiss = useCallback(() => {
    if (pending) dismissPending(tab.id, pending.requestId);
  }, [tab.id, pending?.requestId]);
  const expression = pending
    ? companionProgress(pending).expression
    : (speech?.expression ?? "idle");
  if (!preferences.visible && !pending) return null;
  return (
    <aside
      aria-label="小猫与浏览进度"
      data-testid="companion-dock"
      className={
        "pointer-events-none fixed bottom-3 right-3 z-40 flex max-h-[calc(100dvh-7rem)] max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 sm:bottom-4 sm:right-4"
      }
    >
      {pending ? (
        <NavigationProgress
          pending={pending}
          companion={preferences.visible}
          expanded={open}
          onRetry={onRetry}
          onCancel={onCancel}
          onSettings={onSettings}
          onSelectCandidate={onSelectCandidate}
          onDismiss={onDismiss}
          onCollapse={() => setExpanded((v) => !v)}
        />
      ) : speech && preferences.visible ? (
        <div
          role="status"
          className="cat-bubble pointer-events-auto relative w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[#b8d69a]/25 bg-[#252c21] p-4 pr-9 text-sm leading-6 text-[#dce3d2] shadow-xl"
        >
          <p>{speech.text}</p>
          <button
            aria-label="关闭小猫气泡"
            onClick={dismiss}
            className="absolute right-2 top-1 rounded p-1 text-[#a5b49a] hover:text-white focus-visible:outline-2"
          >
            ×
          </button>
        </div>
      ) : null}
      {preferences.visible && (
        <button
          aria-label={pending ? "小猫：展开或折叠进度" : "摸摸小猫"}
          aria-expanded={pending ? open : undefined}
          onClick={() => (pending ? setExpanded((v) => !v) : speak("click"))}
          className="pointer-events-auto shrink-0 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-[#b8d69a]"
          data-testid="companion-cat"
          data-expression={expression}
        >
          <span aria-hidden="true" className={"cat-sprite cat-" + expression} />
        </button>
      )}
    </aside>
  );
}
