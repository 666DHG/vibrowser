import { useEffect, useRef, useState } from "react";
import type { PendingNavigation } from "../objects/BrowserState";

export function useProgressPresence(
  pending: PendingNavigation | null,
  fullscreen: boolean,
  onDismiss: () => void,
) {
  const [shown, setShown] = useState<PendingNavigation | null>(null);
  const [exiting, setExiting] = useState(false);
  const latest = useRef({ pending, onDismiss });
  latest.current = { pending, onDismiss };
  useEffect(() => {
    if (!pending) {
      setExiting(true);
      const timer = setTimeout(() => setShown(null), 140);
      return () => clearTimeout(timer);
    }
    setExiting(false);
    setShown(null);
    const timer = setTimeout(
      () => {
        const current = latest.current;
        if (current.pending?.requestId !== pending.requestId) return;
        if (current.pending.status === "complete") current.onDismiss();
        else setShown(current.pending);
      },
      fullscreen ? 0 : 150,
    );
    return () => clearTimeout(timer);
  }, [pending?.requestId]);
  useEffect(() => {
    if (pending && shown?.requestId === pending.requestId) setShown(pending);
  }, [pending, shown?.requestId]);
  return { shown, exiting };
}
