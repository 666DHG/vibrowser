import { useEffect, useRef } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import type { BrowserTab } from "../objects/BrowserState";
import { HomePage } from "./HomePage";
import { PageRenderer } from "./PageRenderer";

type Props = {
  tab: BrowserTab;
  active: boolean;
  onNavigate: (input: string, referrer?: string) => void;
  onRetry: () => void;
  onSettings: () => void;
};
const phases: Record<string, string> = {
  queued: "等待加载",
  generating: "正在加载页面",
  validating: "正在整理内容",
  saving: "即将就绪",
  connecting: "正在连接",
};
export function TabContent({
  tab,
  active,
  onNavigate,
  onRetry,
  onSettings,
}: Props) {
  const { content } = tab;
  const viewport = useRef<HTMLDivElement>(null);
  const loading =
    content.status === "loading" || content.status === "generating";
  const pageId = content.status === "ready" ? content.page.id : null;
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [pageId]);
  return (
    <div
      ref={viewport}
      role="tabpanel"
      id={"panel-" + tab.id}
      aria-labelledby={"tab-" + tab.id}
      hidden={!active}
      tabIndex={0}
      className={
        "relative min-h-0 min-w-0 flex-1 overflow-y-auto " +
        (active ? "" : "hidden")
      }
      data-testid={active ? "content-viewport" : undefined}
    >
      {content.status === "idle" && (
        <HomePage onNavigate={onNavigate} onSettings={onSettings} />
      )}
      {loading && (
        <section className="flex min-h-[65vh] flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-8 flex size-24 items-center justify-center rounded-full border border-[#b8d69a]/15">
            <LoaderCircle
              className="animate-spin text-[#b8d69a]"
              size={30}
              strokeWidth={1}
            />
            <span className="absolute -right-1 top-3 size-2 rounded-full bg-[#b8d69a]" />
          </div>
          <p className="mb-3 font-mono text-[10px] tracking-[.2em] text-[#80966a]">
            VIBE ENGINE
          </p>
          <h1 className="text-2xl">
            {phases[
              content.status === "generating" ? content.job.phase : "connecting"
            ] ?? "生成中"}
          </h1>
          <p className="mt-4 max-w-md break-all text-sm text-[#87977a]">
            {content.status === "loading"
              ? content.input
              : content.status === "generating"
                ? content.page.prompt
                : ""}
          </p>
        </section>
      )}
      {content.status === "ready" && content.page.spec && (
        <PageRenderer
          spec={content.page.spec}
          onNavigate={(target) =>
            onNavigate(
              new URL(target, content.page.address).href,
              content.page.id,
            )
          }
        />
      )}
      {content.status === "error" && (
        <section className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center gap-5 p-8 text-center">
          <AlertCircle size={32} className="text-[#c6af80]" />
          <h1 className="text-2xl">页面暂时无法打开</h1>
          <p role="alert" className="text-sm leading-7 text-[#a2ad96]">
            {content.message}
          </p>
          <div className="flex gap-4">
            {content.page && (
              <button
                onClick={onRetry}
                className="cursor-pointer rounded-full bg-[#b8d69a] px-6 py-3 text-xs text-[#26301e]"
              >
                重新尝试
              </button>
            )}
            <button
              onClick={onSettings}
              className="cursor-pointer rounded-full border border-white/15 px-6 py-3 text-xs"
            >
              打开设置
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
