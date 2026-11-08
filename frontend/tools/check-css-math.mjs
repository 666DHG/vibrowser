import { writeFile, mkdir } from "node:fs/promises";
import { readFile } from "./local-evidence.mjs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { frameSource } from "../dist-measure/webRuntime.mjs";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve("../.cache/playwright");
const { chromium } = await import("playwright");
const before = JSON.parse(
  await readFile(
    "../.cache/effort-guidance-v9/comparison-new-standard.json",
    "utf8",
  ),
);
const after = JSON.parse(
  await readFile(
    "../.cache/design-draft-replay-comparison/comparison-new-standard.json",
    "utf8",
  ),
);
const browser = await chromium.launch({ channel: "chromium" });
const output = "../.data/release-archive/docs/screenshots/css-math-replay";
await mkdir(output, { recursive: true });
const measurements = [];
try {
  for (const width of [1440, 390]) {
    for (const [name, record] of [
      ["before", before],
      ["after", after],
    ]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route("**/*", (r) => r.abort());
      await page.setContent(
        frameSource(record.document, "css-math", "offline"),
      );
      const metrics = await page
        .locator(".wrap")
        .first()
        .evaluate((e) => {
          const r = e.getBoundingClientRect();
          return {
            left: r.left,
            width: r.width,
            scrollWidth: document.documentElement.scrollWidth,
          };
        });
      await page.screenshot({ path: resolve(output, `${name}-${width}.png`) });
      measurements.push({ name, viewport: width, ...metrics });
      if (name === "after") {
        assert(metrics.left > 8, "Container gutter must survive normalization");
        assert(
          metrics.scrollWidth <= width,
          "Container must not overflow viewport",
        );
        if (width === 1440) assert(Math.abs(metrics.width - 1120) < 1);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  "../.data/release-archive/docs/acceptance/css-math-replay-layout.json",
  JSON.stringify(
    {
      method:
        "Same saved model output; original and corrected backend CSS normalization; offline Chromium, no model calls.",
      pageId: before.pageId,
      jobId: before.jobId,
      measurements,
    },
    null,
    2,
  ),
);
console.log(measurements);
