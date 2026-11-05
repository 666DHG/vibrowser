import { useEffect, useMemo, useRef } from "react";
import type { WebDocument, WebAction } from "../../../shared/webDocument";
import { frameSource } from "../functions/webRuntime";
export function WebDocumentFrame({
  document: doc,
  onAction,
  onPreview,
  onState,
  savedState,
  savedScroll,
}: {
  document: WebDocument;
  onAction: (action: WebAction, values: Record<string, string>) => void;
  onPreview: (target: string) => void;
  onState?: (state: Record<string, string>, scroll?: number) => void;
  savedState?: Record<string, string>;
  savedScroll?: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const instance = useMemo(() => crypto.randomUUID(), [doc]);
  const source = useMemo(
    () =>
      frameSource(doc, instance, crypto.randomUUID(), savedState, savedScroll),
    [doc, instance],
  );
  const callbacks = useRef({ onAction, onPreview, onState });
  callbacks.current = { onAction, onPreview, onState };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.instance !== instance ||
        event.origin !== "null"
      )
        return;
      const message = event.data;
      const action = doc.actions.find((a) => a.id === message.actionId);
      if (message.type === "preview")
        callbacks.current.onPreview(
          action?.kind === "Navigate" ? (action.target ?? "") : "",
        );
      if (
        message.type === "action" &&
        action &&
        message.values &&
        Object.values(message.values).every((v) => typeof v === "string")
      )
        callbacks.current.onAction(action, message.values);
      if (
        message.type === "state" &&
        message.state &&
        Object.values(message.state).every((v) => typeof v === "string")
      )
        callbacks.current.onState?.(message.state, message.scroll);
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      callbacks.current.onPreview("");
    };
  }, [doc, instance]);
  return (
    <iframe
      ref={frame}
      title={doc.title}
      data-testid="web-document"
      sandbox="allow-scripts"
      srcDoc={source}
      className="block h-full w-full border-0 bg-white"
    />
  );
}
