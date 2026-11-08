import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type {
  PlanetMeteor,
  PlanetProjection,
  PlanetSample,
} from "../objects/PlanetScene";
import {
  beginPlanetDrag,
  cancelPlanetDrag,
  dragPlanet,
  initialPlanetMotion,
  releasePlanet,
  resetPlanet,
  stepPlanet,
} from "../functions/planetMotion";
import {
  createPlanetMeteor,
  planetLayout,
  projectPlanet,
  renderAsciiPlanet,
} from "../functions/asciiPlanet";

export function usePlanetAnimation(active: boolean) {
  const element = useRef<HTMLDivElement>(null);
  const motion = useRef(initialPlanetMotion());
  const projection = useRef<PlanetProjection | null>(null);
  const reduced = useRef(false),
    running = useRef(false),
    time = useRef(0);
  const meteor = useRef<PlanetMeteor | null>(null),
    nextMeteor = useRef(1.2);
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    samples: PlanetSample[];
  } | null>(null);
  const [frame, setFrame] = useState({
    text: "",
    yaw: 0.35,
    pitch: (20 * Math.PI) / 180,
    time: 0,
    columns: 0,
    rows: 0,
    fontSize: 10,
    spacing: 0,
    lineHeight: 11,
    mode: "idle",
    dragging: false,
  });
  const draw = () => {
    const view = projection.current;
    if (!view) return;
    const { width, height, columns, rows, fontSize } = view.layout;
    const { rotation, mode } = motion.current;
    setFrame({
      text: renderAsciiPlanet(
        view,
        rotation,
        time.current,
        meteor.current,
        reduced.current,
      ),
      ...rotation,
      time: time.current,
      columns,
      rows,
      fontSize,
      spacing: width / columns - fontSize * 0.6,
      lineHeight: height / rows,
      mode,
      dragging: !!pointer.current,
    });
  };
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let intersecting = false,
      animation = 0,
      last = 0,
      lastDraw = 0;
    const tick = (now: number) => {
      if (!running.current) return;
      const seconds = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      motion.current = stepPlanet(motion.current, seconds);
      time.current += seconds;
      if (
        meteor.current &&
        time.current - meteor.current.born >= meteor.current.duration
      )
        meteor.current = null;
      if (!meteor.current && time.current >= nextMeteor.current) {
        if (motion.current.mode === "idle") {
          meteor.current = createPlanetMeteor(time.current, Math.random());
          nextMeteor.current = time.current + 2 + Math.random() * 1.5;
        } else nextMeteor.current = time.current + 0.5;
      }
      if (now - lastDraw >= 1000 / 30) {
        draw();
        lastDraw = now - ((now - lastDraw) % (1000 / 30));
      }
      animation = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(animation);
      last = 0;
      lastDraw = 0;
      reduced.current = preference.matches;
      running.current =
        active && intersecting && !document.hidden && !reduced.current;
      if (!running.current) {
        pointer.current = null;
        motion.current = cancelPlanetDrag(motion.current, reduced.current);
        meteor.current = null;
        draw();
      } else animation = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      projection.current = projectPlanet(
        planetLayout(width, height, innerWidth < 1024),
      );
      draw();
    });
    const visibility = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    resize.observe(node);
    visibility.observe(node);
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      running.current = false;
      cancelAnimationFrame(animation);
      resize.disconnect();
      visibility.disconnect();
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      pointer.current = null;
    };
  }, [active]);
  const width = () => Math.max(1, element.current?.clientWidth ?? 1);
  const cancel = () => {
    pointer.current = null;
    motion.current = cancelPlanetDrag(motion.current, reduced.current);
    draw();
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!active || !event.isPrimary || event.button !== 0 || pointer.current)
      return;
    const sample = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
    pointer.current = { id: event.pointerId, ...sample, samples: [sample] };
    event.currentTarget.setPointerCapture(event.pointerId);
    motion.current = beginPlanetDrag(motion.current);
    draw();
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointer.current;
    if (!previous || previous.id !== event.pointerId) return;
    const now = performance.now(),
      sample = { x: event.clientX, y: event.clientY, time: now };
    motion.current = dragPlanet(
      motion.current,
      sample.x - previous.x,
      sample.y - previous.y,
      width(),
      reduced.current,
    );
    pointer.current = {
      id: previous.id,
      ...sample,
      samples: [...previous.samples.filter((s) => now - s.time <= 100), sample],
    };
    if (reduced.current) draw();
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointer.current;
    if (!previous || previous.id !== event.pointerId) return;
    motion.current = releasePlanet(
      motion.current,
      previous.samples,
      performance.now(),
      width(),
      reduced.current,
    );
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    draw();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      pointer.current = null;
      motion.current = resetPlanet(motion.current, reduced.current);
      draw();
      return;
    }
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-0.04, 0],
      ArrowRight: [0.04, 0],
      ArrowUp: [0, -0.06],
      ArrowDown: [0, 0.06],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const state = dragPlanet(
      beginPlanetDrag(motion.current),
      direction[0] * width(),
      direction[1] * width(),
      width(),
      true,
    );
    // A short reset interpolation gives keyboard changes the same eased arrival.
    motion.current = reduced.current
      ? cancelPlanetDrag(state, true)
      : {
          ...state,
          mode: "reset",
          rotation: motion.current.rotation,
          resetFrom: motion.current.rotation,
          resetElapsed: 0,
        };
    draw();
  };
  return {
    element,
    frame,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: cancel,
    onLostPointerCapture: () => {
      if (pointer.current) cancel();
    },
    onKeyDown,
  };
}
