import { displayAddress } from "../functions/displayAddress";
import { useProgressPresence } from "../hooks/useProgressPresence";
import { navigationTarget } from "../functions/navigationTarget";
import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import type { BrowserTab } from "../objects/BrowserState";
import { HomePage } from "./HomePage";
import { PageRenderer } from "./PageRenderer";
import { NavigationProgress } from "./NavigationProgress";
import { updatePending, dismissPending } from "../stores/browserStore";
type Props = {
  tab: BrowserTab;
  active: boolean;
  onNavigate: (
    input: string,
    referrer?: string,
    sourceBlockId?: string,
  ) => void;
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
  const [arriving, setArriving] = useState(false);
  useEffect(() => {
    setArriving(content.status === "ready");
    const timer = setTimeout(() => setArriving(false), 120);
    return () => clearTimeout(timer);
  }, [pageId]);
  useEffect(() => setArriving(false), [active]);
  const dismiss = useCallback(() => {
    if (pending) dismissPending(tab.id, pending.requestId);
  }, [tab.id, pending?.requestId]);
  const fullscreen = content.status === "idle" && !!pending;
  const { shown, exiting } = useProgressPresence(pending, fullscreen, dismiss);
  const [preview, setPreview] = useState("");
  const hovered = useRef<Element | null>(null);
  const clearPreview = () => {
    hovered.current = null;
    setPreview("");
  };
  const previewTarget = (target: EventTarget | null) => {
    const element =
      target instanceof Element
        ? target.closest<HTMLElement>("[data-navigation-target]")
        : null;
    hovered.current = element;
    const value = element?.dataset.navigationTarget;
    setPreview(
      value
        ? navigationTarget(
            value,
            content.status === "ready" ? content.page.address : undefined,
          )
        : "",
    );
  };
  useEffect(clearPreview, [active, pending?.requestId, pageId]);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (hovered.current && !hovered.current.isConnected) clearPreview();
    });
    if (viewport.current)
      observer.observe(viewport.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return (
    <div
      onMouseMove={(event) => previewTarget(event.target)}
      onMouseOver={(event) => previewTarget(event.target)}
      onMouseOut={(event) => previewTarget(event.relatedTarget)}
      onFocusCapture={(event) => previewTarget(event.target)}
      onBlurCapture={clearPreview}
      onScrollCapture={clearPreview}
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
        className="h-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
        data-testid={active ? "content-viewport" : undefined}
      >
        {content.status === "idle" && !pending && (
          <HomePage onNavigate={onNavigate} onSettings={onSettings} />
        )}
        {content.status === "bookmarks" && bookmarks}
        {content.status === "ready" && content.page.spec && (
          <div
            key={content.page.id}
            className={"min-h-full " + (arriving ? "page-arrival" : "")}
          >
            <PageRenderer
              spec={content.page.spec}
              onNavigate={(target, sourceBlockId) =>
                onNavigate(
                  navigationTarget(target, content.page.address),
                  content.page.id,
                  sourceBlockId,
                )
              }
            />
          </div>
        )}
        {fullscreen && shown && (
          <NavigationProgress
            pending={shown}
            exiting={exiting}
            fullscreen
            onRetry={onRetry}
            onCancel={onCancel}
            onDismiss={dismiss}
            onCollapse={() => {}}
          />
        )}
      </div>
      {!fullscreen && shown && (
        <NavigationProgress
          pending={shown}
          exiting={exiting}
          fullscreen={false}
          onRetry={onRetry}
          onCancel={onCancel}
          onDismiss={dismiss}
          onCollapse={() =>
            updatePending(tab.id, shown.requestId, {
              collapsed: !shown.collapsed,
            })
          }
        />
      )}
      {active && preview && (
        <div
          data-testid="link-preview"
          className="pointer-events-none absolute bottom-0 left-0 z-30 max-w-[min(70%,640px)] truncate rounded-tr-md border border-white/15 bg-[#252c21] px-3 py-1 font-sans text-xs text-[#dce3d2]"
        >
          {displayAddress(preview)}
        </div>
      )}
    </div>
  );
}
