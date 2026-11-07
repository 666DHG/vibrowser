import { useRef, useState } from "react";
import {
  dragPlanet,
  initialPlanetRotation,
  renderAsciiPlanet,
} from "../functions/asciiPlanet";

export function HomePlanet() {
  const [rotation, setRotation] = useState(initialPlanetRotation);
  const [dragging, setDragging] = useState(false);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <div className="mx-auto w-full max-w-[460px] [container-type:inline-size] max-lg:max-w-[340px]">
      <pre
        role="img"
        aria-label="可旋转的纯文字星球，拖动或使用方向键旋转，Home 键复位"
        tabIndex={0}
        title="拖动旋转 · 方向键旋转 · Home 复位"
        data-testid="ascii-planet"
        className={
          "m-0 touch-none select-none rounded-2xl font-mono [font-variant-ligatures:none] text-[2.3148cqw] leading-none text-[#b8cf9d] focus-visible:outline-1 focus-visible:outline-offset-8 focus-visible:outline-[#b8d69a]/50 " +
          (dragging ? "cursor-grabbing" : "cursor-grab")
        }
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointer.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const previous = pointer.current;
          if (!previous || previous.id !== event.pointerId) return;
          const scale = 460 / Math.max(1, event.currentTarget.clientWidth);
          setRotation((value) =>
            dragPlanet(
              value,
              (event.clientX - previous.x) * scale,
              (event.clientY - previous.y) * scale,
            ),
          );
          pointer.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
        }}
        onPointerUp={(event) => {
          if (pointer.current?.id !== event.pointerId) return;
          pointer.current = null;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          pointer.current = null;
          setDragging(false);
        }}
        onLostPointerCapture={() => {
          pointer.current = null;
          setDragging(false);
        }}
        onKeyDown={(event) => {
          const directions: Record<string, [number, number]> = {
            ArrowLeft: [-10, 0],
            ArrowRight: [10, 0],
            ArrowUp: [0, -10],
            ArrowDown: [0, 10],
          };
          if (event.key === "Home") {
            event.preventDefault();
            setRotation(initialPlanetRotation);
          } else if (directions[event.key]) {
            event.preventDefault();
            const [x, y] = directions[event.key];
            setRotation((value) => dragPlanet(value, x, y));
          }
        }}
      >
        {renderAsciiPlanet(rotation)}
      </pre>
    </div>
  );
}
