import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

export function useCompanionDrag(enabled: boolean) {
  const dock = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ right: 16, bottom: 16 });
  const [dragging, setDragging] = useState(false);
  const suppressClick = useRef(false);
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    right: number;
    bottom: number;
  } | null>(null);
  const clamp = (right: number, bottom: number) => {
    const box = dock.current?.getBoundingClientRect();
    return {
      right: Math.max(
        12,
        Math.min(right, innerWidth - (box?.width ?? 104) - 12),
      ),
      bottom: Math.max(
        12,
        Math.min(bottom, innerHeight - (box?.height ?? 104) - 112),
      ),
    };
  };
  useEffect(() => {
    if (!enabled || !dock.current) return;
    const resize = () =>
      setPosition((p) => {
        const next = clamp(p.right, p.bottom);
        return next.right === p.right && next.bottom === p.bottom ? p : next;
      });
    const observer = new ResizeObserver(resize);
    observer.observe(dock.current);
    window.addEventListener("resize", resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [enabled]);
  const finish = () => {
    pointer.current = null;
    setDragging(false);
  };
  return {
    dock,
    position,
    dragging,
    suppressClick,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (!event.isPrimary || event.button !== 0) return;
      suppressClick.current = false;
      pointer.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        ...position,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const start = pointer.current;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x,
        dy = event.clientY - start.y;
      if (!suppressClick.current && Math.hypot(dx, dy) < 5) return;
      suppressClick.current = true;
      setDragging(true);
      setPosition(clamp(start.right - dx, start.bottom - dy));
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      if (pointer.current?.id !== event.pointerId) return;
      finish();
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: finish,
    onLostPointerCapture: finish,
  };
}
