import type {
  PlanetMotion,
  PlanetRotation,
  PlanetSample,
} from "../objects/PlanetScene";
export const pitchMin = (12 * Math.PI) / 180;
export const pitchMax = (32 * Math.PI) / 180;
export const idleSpeed = (2 * Math.PI) / 18;
export const initialPlanetRotation: PlanetRotation = {
  yaw: 0.35,
  pitch: (20 * Math.PI) / 180,
};
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
export function initialPlanetMotion(): PlanetMotion {
  return {
    rotation: { ...initialPlanetRotation },
    target: { ...initialPlanetRotation },
    velocity: { yaw: idleSpeed, pitch: 0 },
    mode: "idle",
    resetFrom: { ...initialPlanetRotation },
    resetElapsed: 0,
  };
}
export function beginPlanetDrag(state: PlanetMotion): PlanetMotion {
  return {
    ...state,
    mode: "dragging",
    target: state.rotation,
    velocity: { yaw: 0, pitch: 0 },
  };
}
export function dragPlanet(
  state: PlanetMotion,
  dx: number,
  dy: number,
  width: number,
  reduced = false,
): PlanetMotion {
  const angle = (dy / Math.max(1, width)) * 0.6;
  const remaining =
    angle > 0 ? pitchMax - state.target.pitch : state.target.pitch - pitchMin;
  const resistance = clamp(remaining / ((4 * Math.PI) / 180), 0.12, 1);
  const target = {
    yaw: state.target.yaw + (dx / Math.max(1, width)) * Math.PI,
    pitch: clamp(state.target.pitch + angle * resistance, pitchMin, pitchMax),
  };
  return { ...state, target, rotation: reduced ? target : state.rotation };
}
export function releasePlanet(
  state: PlanetMotion,
  samples: PlanetSample[],
  now: number,
  width: number,
  reduced = false,
): PlanetMotion {
  const recent = samples.filter((s) => now - s.time <= 100);
  const last = samples.at(-1);
  const first = recent[0];
  const duration = first && last ? (last.time - first.time) / 1000 : 0;
  const moving = last && now - last.time <= 120 && duration > 0.008;
  const velocity =
    moving && !reduced
      ? {
          yaw: clamp(
            (((last.x - first.x) / Math.max(1, width)) * Math.PI) / duration,
            -2.4,
            2.4,
          ),
          pitch: clamp(
            (((last.y - first.y) / Math.max(1, width)) * 0.6) / duration,
            -0.35,
            0.35,
          ),
        }
      : { yaw: 0, pitch: 0 };
  return { ...state, mode: "idle", target: state.rotation, velocity };
}
export function cancelPlanetDrag(
  state: PlanetMotion,
  reduced = false,
): PlanetMotion {
  return {
    ...state,
    mode: "idle",
    target: state.rotation,
    velocity: { yaw: reduced ? 0 : idleSpeed, pitch: 0 },
  };
}
export function resetPlanet(
  state: PlanetMotion,
  reduced = false,
): PlanetMotion {
  const nearestYaw =
    state.rotation.yaw +
    Math.atan2(
      Math.sin(initialPlanetRotation.yaw - state.rotation.yaw),
      Math.cos(initialPlanetRotation.yaw - state.rotation.yaw),
    );
  const target = { yaw: nearestYaw, pitch: initialPlanetRotation.pitch };
  return {
    ...state,
    mode: reduced ? "idle" : "reset",
    rotation: reduced ? target : state.rotation,
    target,
    resetFrom: state.rotation,
    resetElapsed: 0,
    velocity: { yaw: 0, pitch: 0 },
  };
}
export function stepPlanet(
  state: PlanetMotion,
  seconds: number,
  reduced = false,
): PlanetMotion {
  if (reduced) return state;
  const dt = Math.max(0, seconds);
  if (state.mode === "dragging") {
    const blend = 1 - Math.exp(-dt / 0.045);
    return {
      ...state,
      rotation: {
        yaw:
          state.rotation.yaw + (state.target.yaw - state.rotation.yaw) * blend,
        pitch:
          state.rotation.pitch +
          (state.target.pitch - state.rotation.pitch) * blend,
      },
    };
  }
  if (state.mode === "reset") {
    const elapsed = Math.min(0.35, state.resetElapsed + dt),
      t = elapsed / 0.35,
      e = t * t * (3 - 2 * t);
    const rotation = {
      yaw: state.resetFrom.yaw + (state.target.yaw - state.resetFrom.yaw) * e,
      pitch:
        state.resetFrom.pitch +
        (state.target.pitch - state.resetFrom.pitch) * e,
    };
    return {
      ...state,
      rotation,
      resetElapsed: elapsed,
      mode: elapsed === 0.35 ? "idle" : "reset",
    };
  }
  const decay = Math.exp(-dt / 0.8),
    pitchDecay = Math.exp(-dt / 0.22);
  const yaw =
    state.rotation.yaw +
    idleSpeed * dt +
    (state.velocity.yaw - idleSpeed) * 0.8 * (1 - decay);
  const rawPitch =
    state.rotation.pitch + state.velocity.pitch * 0.22 * (1 - pitchDecay);
  const pitch = clamp(rawPitch, pitchMin, pitchMax);
  const velocity = {
    yaw: idleSpeed + (state.velocity.yaw - idleSpeed) * decay,
    pitch: rawPitch !== pitch ? 0 : state.velocity.pitch * pitchDecay,
  };
  return {
    ...state,
    rotation: { yaw, pitch },
    target: { yaw, pitch },
    velocity,
  };
}
