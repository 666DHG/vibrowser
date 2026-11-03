export function navigationTarget(target: string, base?: string): string {
  if (target.startsWith("vibe://search?")) return target;
  return new URL(
    base ? target : /^https?:\/\//i.test(target) ? target : "https://" + target,
    base,
  ).href;
}
