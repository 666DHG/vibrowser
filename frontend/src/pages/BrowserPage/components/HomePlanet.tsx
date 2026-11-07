import { usePlanetAnimation } from "../hooks/usePlanetAnimation";
export function HomePlanet({ active }: { active: boolean }) {
  const { element, frame, ...events } = usePlanetAnimation(active);
  return (
    <div
      ref={element}
      {...events}
      role="img"
      tabIndex={0}
      aria-label="自动旋转的纯文字星球，拖动或使用方向键旋转，Home 键复位"
      title="拖动旋转 · 方向键旋转 · Home 复位"
      data-testid="ascii-planet"
      data-yaw={frame.yaw}
      data-pitch={frame.pitch}
      data-time={frame.time}
      data-motion={frame.mode}
      className={
        "h-[clamp(280px,42vw,360px)] w-full touch-none overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#b8d69a]/40 lg:h-full " +
        (frame.dragging ? "cursor-grabbing" : "cursor-grab")
      }
    >
      <pre
        aria-hidden="true"
        data-testid="planet-characters"
        className="pointer-events-none m-0 select-none text-[#b8cf9d] [font-variant-ligatures:none] [mask-image:linear-gradient(to_right,transparent,black_22%)]"
        style={{
          fontFamily: '"Courier New", monospace',
          fontSize: frame.fontSize,
          letterSpacing: frame.spacing,
          lineHeight: `${frame.lineHeight}px`,
        }}
      >
        {frame.text}
      </pre>
    </div>
  );
}
