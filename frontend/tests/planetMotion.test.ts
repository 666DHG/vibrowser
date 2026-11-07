import type { PlanetMotion } from "../src/pages/BrowserPage/objects/PlanetScene";
import { describe, it, expect } from "vitest";
import {
  beginPlanetDrag,
  cancelPlanetDrag,
  dragPlanet,
  initialPlanetMotion,
  idleSpeed,
  pitchMin,
  pitchMax,
  releasePlanet,
  resetPlanet,
  stepPlanet,
} from "../src/pages/BrowserPage/functions/planetMotion";
import {
  createPlanetMeteor,
  planetLayout,
  projectPlanet,
  renderAsciiPlanet,
} from "../src/pages/BrowserPage/functions/asciiPlanet";
describe("planet motion", () => {
  it("integrates inertia consistently at different frame rates", () => {
    const start = {
      ...initialPlanetMotion(),
      velocity: { yaw: -1.8, pitch: 0.15 },
    };
    const simulate = (fps: number) =>
      Array.from({ length: fps * 2 }).reduce<PlanetMotion>(
        (state) => stepPlanet(state, 1 / fps),
        start,
      );
    expect(simulate(30).rotation.yaw).toBeCloseTo(
      simulate(120).rotation.yaw,
      10,
    );
    expect(simulate(30).rotation.pitch).toBeCloseTo(
      simulate(120).rotation.pitch,
      10,
    );
  });
  it("constrains pitch without accumulating overscroll and responds to reversal", () => {
    const start = beginPlanetDrag(initialPlanetMotion());
    const edge = dragPlanet(start, 0, 5000, 500, true);
    expect(edge.rotation.pitch).toBe(pitchMax);
    const reverse = dragPlanet(edge, 0, -30, 500, true);
    expect(reverse.rotation.pitch).toBeLessThan(pitchMax);
    expect(dragPlanet(start, 0, -5000, 500, true).rotation.pitch).toBe(
      pitchMin,
    );
    const inertia = stepPlanet(
      { ...edge, mode: "idle", velocity: { yaw: 2, pitch: 0.35 } },
      1,
    );
    expect(inertia.rotation.pitch).toBe(pitchMax);
    expect(inertia.velocity.pitch).toBe(0);
  });
  it("limits release speed and discards a stale fling", () => {
    const state = beginPlanetDrag(initialPlanetMotion());
    const samples = [
      { x: 0, y: 0, time: 0 },
      { x: 1000, y: 1000, time: 90 },
    ];
    const released = releasePlanet(state, samples, 95, 500);
    expect(released.velocity).toEqual({ yaw: 2.4, pitch: 0.35 });
    expect(releasePlanet(state, samples, 220, 500).velocity).toEqual({
      yaw: 0,
      pitch: 0,
    });
    expect(stepPlanet(released, 8).velocity.yaw).toBeCloseTo(idleSpeed, 3);
  });
  it("smoothly follows a drag target and resets by the shortest rotation", () => {
    const drag = dragPlanet(
      beginPlanetDrag(initialPlanetMotion()),
      100,
      0,
      500,
    );
    const next = stepPlanet(drag, 0.016);
    expect(next.rotation.yaw).toBeGreaterThan(drag.rotation.yaw);
    expect(next.rotation.yaw).toBeLessThan(drag.target.yaw);
    const reset = resetPlanet({
      ...initialPlanetMotion(),
      rotation: { yaw: 20, pitch: pitchMax },
    });
    expect(Math.abs(reset.target.yaw - 20)).toBeLessThanOrEqual(Math.PI);
    const done = stepPlanet(reset, 0.35);
    expect(done.mode).toBe("idle");
    expect(done.rotation.pitch).toBeCloseTo((20 * Math.PI) / 180);
  });
  it("reduced motion renders direct input with no automatic displacement", () => {
    const state = dragPlanet(
      beginPlanetDrag(initialPlanetMotion()),
      100,
      20,
      500,
      true,
    );
    expect(state.rotation).toEqual(state.target);
    expect(stepPlanet(state, 10, true)).toEqual(state);
    expect(cancelPlanetDrag(state, true).velocity).toEqual({
      yaw: 0,
      pitch: 0,
    });
  });
});
describe("ASCII scene", () => {
  it("bounds responsive grid dimensions", () => {
    const large = planetLayout(2000, 1000, false);
    expect(large.columns).toBe(120);
    expect(large.rows).toBe(64);
    expect(planetLayout(390, 280, true).fontSize).toBe(9);
  });
  it("renders deterministic frames and continuous changes without changing layout", () => {
    const projection = projectPlanet(planetLayout(700, 500, false)),
      rotation = initialPlanetMotion().rotation;
    const text = renderAsciiPlanet(projection, rotation, 0);
    expect(text).toBe(renderAsciiPlanet(projection, rotation, 0));
    expect(
      text.split("\n").every((row) => row.length === projection.layout.columns),
    ).toBe(true);
    expect(renderAsciiPlanet(projection, { ...rotation, yaw: 1 }, 1)).not.toBe(
      text,
    );
  });
  it("clips background meteors behind the sphere and expires them", () => {
    const projection = projectPlanet(planetLayout(700, 500, false)),
      rotation = initialPlanetMotion().rotation,
      meteor = createPlanetMeteor(0, 0.3);
    const baseline = renderAsciiPlanet(projection, rotation, 0.5),
      frame = renderAsciiPlanet(projection, rotation, 0.5, meteor);
    expect(frame).not.toBe(baseline);
    const a = baseline.replaceAll("\n", ""),
      b = frame.replaceAll("\n", "");
    projection.pixels.forEach((pixel, i) => {
      if (pixel.depth !== Infinity) expect(b[i]).toBe(a[i]);
    });
    expect(renderAsciiPlanet(projection, rotation, 2, meteor)).toBe(
      renderAsciiPlanet(projection, rotation, 2),
    );
    expect(renderAsciiPlanet(projection, rotation, 2, meteor, true)).toBe(
      renderAsciiPlanet(projection, rotation, 0, null, true),
    );
  });
});
