import { useEffect, useRef, useCallback, type ReactNode } from "react";
import type { BrowserTab } from "../objects/BrowserState";
import { HomePage } from "./HomePage";
import { PageRenderer } from "./PageRenderer";
import { NavigationProgress } from "./NavigationProgress";
import { updatePending, dismissPending } from "../stores/browserStore";
type Props = {
  tab: BrowserTab;
  active: boolean;
  onNavigate: (input: string, referrer?: string) => void;
  onRetry: () => void;
  onCancel: () => void;
  onSettings: () => void;
  bookmarks?: ReactNode;
};
export function TabContent({
  tab,
  active,
  onNavigate,
  onRetry,
  onCancel,
  onSettings,
  bookmarks,
}: Props) {
  const { content, pending } = tab;
  const viewport = useRef<HTMLDivElement>(null);
  const pageId = content.status === "ready" ? content.page.id : content.status;
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [pageId]);
  const dismiss = useCallback(() => {
    if (pending) dismissPending(tab.id, pending.requestId);
  }, [tab.id, pending?.requestId]);
  const fullscreen = content.status === "idle" && !!pending;
  return (
    <div
      role="tabpanel"
      id={"panel-" + tab.id}
      aria-labelledby={"tab-" + tab.id}
      hidden={!active}
      className={
        "relative min-h-0 min-w-0 flex-1 overflow-hidden " +
        (active ? "" : "hidden")
      }
    >
      <div
        ref={viewport}
        tabIndex={0}
        className="h-full overflow-y-auto"
        data-testid={active ? "content-viewport" : undefined}
      >
        {content.status === "idle" && !pending && (
          <HomePage onNavigate={onNavigate} onSettings={onSettings} />
        )}
        {content.status === "bookmarks" && bookmarks}
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
        {fullscreen && pending && (
          <NavigationProgress
            pending={pending}
            fullscreen
            onRetry={onRetry}
            onCancel={onCancel}
            onDismiss={dismiss}
            onCollapse={() => {}}
          />
        )}
      </div>
      {!fullscreen && pending && (
        <NavigationProgress
          pending={pending}
          fullscreen={false}
          onRetry={onRetry}
          onCancel={onCancel}
          onDismiss={dismiss}
          onCollapse={() =>
            updatePending(tab.id, pending.requestId, {
              collapsed: !pending.collapsed,
            })
          }
        />
      )}
    </div>
  );
}
