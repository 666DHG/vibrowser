import type {
  PlanetLayout,
  PlanetMeteor,
  PlanetProjection,
  PlanetRotation,
} from "../objects/PlanetScene";
const ramp = ".:-=+*#%@";
export function planetLayout(
  width: number,
  height: number,
  mobile: boolean,
): PlanetLayout {
  const fontSize = mobile ? 9 : 10;
  return {
    width,
    height,
    fontSize,
    columns: Math.max(1, Math.min(120, Math.floor(width / (fontSize * 0.6)))),
    rows: Math.max(1, Math.min(64, Math.floor(height / (fontSize * 1.1)))),
  };
}
export function projectPlanet(layout: PlanetLayout): PlanetProjection {
  const { width, height, columns, rows } = layout,
    radius = height * 0.48;
  const pixels = Array.from({ length: columns * rows }, (_, i) => {
    const x =
      ((((i % columns) + 0.5) / columns) * width - width * 0.78) / radius;
    const y =
      (height * 0.48 - ((Math.floor(i / columns) + 0.5) / rows) * height) /
      radius;
    const distance = x * x + y * y,
      z = Math.sqrt(Math.max(0, 1 - distance));
    return { x, y, z, depth: distance <= 1 ? 4 - z : Infinity };
  });
  return { layout, pixels };
}
export function createPlanetMeteor(time: number, random: number): PlanetMeteor {
  return {
    born: time,
    duration: 1 + random * 0.35,
    startX: 0,
    endX: 0.45 + random * 0.15,
    length: 8 + Math.floor(random * 5),
  };
}
export function renderAsciiPlanet(
  projection: PlanetProjection,
  rotation: PlanetRotation,
  time = 0,
  meteor: PlanetMeteor | null = null,
  reduced = false,
): string {
  const { columns, rows } = projection.layout;
  const animationTime = reduced ? 0 : time;
  const characters = Array<string>(columns * rows).fill(" ");
  // Stable positions and staggered phases; randomness belongs to the scheduler.
  for (let i = 0; i < 28; i++) {
    const x = Math.floor(((i * 0.381966 + 0.07) % 1) * columns),
      y = Math.floor(((i * 0.618034 + 0.09) % 1) * rows);
    const glow = Math.sin(
      (time * 2 * Math.PI) / (1.2 + (i % 5) * 0.35) + i * 1.7,
    );
    characters[y * columns + x] = reduced
      ? "."
      : glow > 0.75
        ? "✦"
        : glow > 0.25
          ? "+"
          : glow > -0.65
            ? "."
            : " ";
  }
  if (meteor && !reduced) {
    const progress = (time - meteor.born) / meteor.duration;
    if (progress >= 0 && progress < 1) {
      for (let i = meteor.length - 1; i >= 0; i--) {
        const t = progress - i * 0.025,
          x = Math.floor(
            (meteor.startX + (meteor.endX - meteor.startX) * t) * columns,
          ),
          y = Math.floor((0.38 + t * 0.7) * rows);
        if (t >= 0 && x >= 0 && x < columns && y >= 0 && y < rows)
          characters[y * columns + x] =
            i === 0 ? "*" : i < 3 ? "+" : i < 5 ? "-" : ".";
      }
    }
  }
  const cy = Math.cos(rotation.yaw),
    sy = Math.sin(rotation.yaw),
    cp = Math.cos(rotation.pitch),
    sp = Math.sin(rotation.pitch),
    cr = Math.cos(-0.38),
    sr = Math.sin(-0.38);
  const rayY = -sp,
    rayZ = -cp;
  const shade = (value: number) =>
    ramp[
      Math.max(0, Math.min(ramp.length - 1, Math.floor(value * ramp.length)))
    ];
  for (let i = 0; i < projection.pixels.length; i++) {
    const { x, y, z, depth } = projection.pixels[i];
    const a = cr * x + sr * y,
      b = -sr * x + cr * y;
    const ringDistance = -(cp * b + sp * 4) / rayY;
    const ringZ = -sp * b + cp * 4 + rayZ * ringDistance;
    const radius = Math.hypot(a, ringZ);
    if (
      ringDistance > 0 &&
      ringDistance < depth &&
      radius > 1.38 &&
      radius < 1.9 &&
      !(radius > 1.57 && radius < 1.64)
    ) {
      characters[i] = shade(
        0.48 +
          0.18 *
            Math.cos(
              Math.atan2(ringZ, a) * 5 - animationTime * 1.6 - rotation.yaw,
            ) +
          Math.sin(radius * 65 - animationTime * 2) * 0.14 +
          0.16 *
            Math.pow(
              Math.max(
                0,
                Math.cos(Math.atan2(ringZ, a) * 3 - animationTime * 2.2),
              ),
              12,
            ),
      );
    } else if (depth !== Infinity) {
      const latitude = Math.asin(Math.max(-1, Math.min(1, cp * b + sp * z)));
      const d = -sp * b + cp * z,
        longitude = Math.atan2(sy * a + cy * d, cy * a - sy * d);
      const texture =
        Math.sin(
          longitude * 4 + Math.sin(latitude * 6 + animationTime * 0.35),
        ) *
        Math.cos(latitude * 9 + Math.sin(longitude * 3 - animationTime * 0.45));
      const light = Math.max(0, -0.45 * x + 0.55 * y + 0.7 * z);
      characters[i] = shade(0.12 + light * (0.57 + texture * 0.32));
    }
  }
  return Array.from({ length: rows }, (_, row) =>
    characters.slice(row * columns, (row + 1) * columns).join(""),
  ).join("\n");
}
