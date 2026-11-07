export interface PlanetRotation {
  yaw: number;
  pitch: number;
}
export const initialPlanetRotation: PlanetRotation = { yaw: 0.35, pitch: 0.35 };
const columns = 72;
const rows = 30;
const ramp = ".:-=+*#%@";
// Orthographic rays intersect a sphere and its tilted ring. Depth chooses the
// visible surface; rotating surface coordinates makes markings follow the globe.
export function renderAsciiPlanet(rotation: PlanetRotation): string {
  const cy = Math.cos(rotation.yaw),
    sy = Math.sin(rotation.yaw);
  const cp = Math.cos(rotation.pitch),
    sp = Math.sin(rotation.pitch);
  const roll = -0.38,
    cr = Math.cos(roll),
    sr = Math.sin(roll);
  const local = (x: number, y: number, z: number) => {
    const a = cr * x + sr * y,
      b = -sr * x + cr * y;
    const c = cp * b + sp * z,
      d = -sp * b + cp * z;
    return [cy * a - sy * d, c, sy * a + cy * d];
  };
  const ray = local(0, 0, -1);
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => {
      const x = (((column + 0.5) / columns) * 2 - 1) * 2.25;
      const y = (1 - ((row + 0.5) / rows) * 2) * 1.5625;
      const r2 = x * x + y * y;
      const z = Math.sqrt(Math.max(0, 1 - r2));
      const sphereDistance = r2 <= 1 ? 4 - z : Infinity;
      const origin = local(x, y, 4);
      const ringDistance =
        Math.abs(ray[1]) > 0.001 ? -origin[1] / ray[1] : Infinity;
      const ringX = origin[0] + ray[0] * ringDistance;
      const ringZ = origin[2] + ray[2] * ringDistance;
      const radius = Math.hypot(ringX, ringZ);
      if (
        ringDistance > 0 &&
        ringDistance < sphereDistance &&
        radius > 1.38 &&
        radius < 1.9 &&
        !(radius > 1.57 && radius < 1.64)
      ) {
        const band = Math.sin(radius * 90) * 0.14;
        const light = 0.48 + 0.18 * Math.cos(Math.atan2(ringZ, ringX)) + band;
        return ramp[
          Math.max(
            0,
            Math.min(ramp.length - 1, Math.floor(light * ramp.length)),
          )
        ];
      }
      if (r2 <= 1) {
        const [a, b, c] = local(x, y, z);
        const longitude = Math.atan2(c, a),
          latitude = Math.asin(Math.max(-1, Math.min(1, b)));
        const texture =
          Math.sin(longitude * 3 + Math.sin(latitude * 5)) *
          Math.cos(latitude * 7 + Math.sin(longitude * 2));
        const light = Math.max(0, -0.45 * x + 0.55 * y + 0.7 * z);
        const value = 0.12 + light * (texture > 0.05 ? 0.8 : 0.46);
        return ramp[
          Math.max(
            0,
            Math.min(ramp.length - 1, Math.floor(value * ramp.length)),
          )
        ];
      }
      return (column === 9 && row === 6) || (column === 60 && row === 24)
        ? "+"
        : (column === 62 && row === 3) ||
            (column === 15 && row === 25) ||
            (column === 34 && row === 2)
          ? "."
          : " ";
    }).join(""),
  ).join("\n");
}
export function dragPlanet(
  rotation: PlanetRotation,
  dx: number,
  dy: number,
): PlanetRotation {
  return {
    yaw: rotation.yaw + dx * 0.012,
    pitch: Math.max(-1.35, Math.min(1.35, rotation.pitch + dy * 0.009)),
  };
}
