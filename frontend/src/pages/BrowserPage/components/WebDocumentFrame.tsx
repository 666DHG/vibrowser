import { useEffect, useState, useRef } from "react";
import type { WebDocument, WebAction } from "../../../shared/webDocument";
import { frameSource } from "../functions/webRuntime";
export function WebDocumentFrame({
  document: doc,
  onAction,
  onPreview,
  onState,
  savedState,
  savedScroll,
  updateActionId,
}: {
  document: WebDocument;
  onAction: (action: WebAction, values: Record<string, string>) => void;
  onPreview: (target: string) => void;
  onState?: (state: Record<string, string>, scroll?: number) => void;
  savedState?: Record<string, string>;
  savedScroll?: number;
  updateActionId?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const createFrame = (value: WebDocument) => {
    const instance = crypto.randomUUID();
    return {
      instance,
      source: frameSource(
        value,
        instance,
        crypto.randomUUID(),
        savedState,
        savedScroll,
      ),
    };
  };
  const [transport, setTransport] = useState(() => createFrame(doc));
  const { instance, source } = transport;
  const previous = useRef(doc);
  const update = useRef<{ document: WebDocument; region: string } | null>(null);
  const deliverUpdate = () => {
    if (update.current)
      frame.current?.contentWindow?.postMessage(
        { type: "document-update", instance, ...update.current },
        "*",
      );
  };
  useEffect(() => {
    if (previous.current === doc) return;
    const action = previous.current.actions.find(
      (a) => a.id === updateActionId,
    );
    previous.current = doc;
    if (
      action?.region &&
      ["Append", "Replace", "Submit"].includes(action.kind)
    ) {
      update.current = { document: doc, region: action.region };
      deliverUpdate();
    } else {
      update.current = null;
      setTransport(createFrame(doc));
    }
  }, [doc]);
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
      if (message.type === "ready") deliverUpdate();
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
      sandbox="allow-scripts allow-forms"
      srcDoc={source}
      className="block h-full w-full border-0 bg-white"
    />
  );
}
