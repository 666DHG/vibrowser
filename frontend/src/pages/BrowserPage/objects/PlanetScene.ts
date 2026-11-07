export interface PlanetRotation {
  yaw: number;
  pitch: number;
}
export interface PlanetMotion {
  rotation: PlanetRotation;
  target: PlanetRotation;
  velocity: PlanetRotation;
  mode: "idle" | "dragging" | "reset";
  resetFrom: PlanetRotation;
  resetElapsed: number;
}
export interface PlanetSample {
  x: number;
  y: number;
  time: number;
}
export interface PlanetLayout {
  width: number;
  height: number;
  columns: number;
  rows: number;
  fontSize: number;
}
export interface PlanetMeteor {
  born: number;
  duration: number;
  startX: number;
  endX: number;
  length: number;
}
export interface PlanetPixel {
  x: number;
  y: number;
  z: number;
  depth: number;
}
export interface PlanetProjection {
  layout: PlanetLayout;
  pixels: PlanetPixel[];
}
