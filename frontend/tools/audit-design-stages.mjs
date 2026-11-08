import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { frameSource } from "../dist-measure/webRuntime.mjs";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve("../.cache/playwright");
const { chromium } = await import("playwright");
const directory = "../.cache/design-stages-v9";
const output = "../docs/screenshots/design-stages-v9";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const results = [];
try {
  for (const file of (await readdir(directory)).sort()) {
    const record = JSON.parse(await readFile(resolve(directory, file), "utf8"));
    const stages = [];
    for (const stage of record.stages) {
      if (!stage.document) {
        stages.push({ stage: stage.stage, error: stage.error });
        continue;
      }
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      await page.route("**/*", (route) => route.abort());
      await page.setContent(
        frameSource(stage.document, "stage-audit", "offline"),
      );
      await page.evaluate(() => document.fonts.ready);
      const visual = await page.evaluate(() => {
        const style = (e) => {
          const s = getComputedStyle(e);
          const r = e.getBoundingClientRect();
          return {
            tag: e.tagName,
            id: e.id,
            font: s.fontFamily,
            size: s.fontSize,
            weight: s.fontWeight,
            display: s.display,
            background: s.backgroundColor,
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
          };
        };
        return {
          body: style(document.body),
          headings: [...document.querySelectorAll("h1,h2,h3")].map((e) => ({
            ...style(e),
            text: e.textContent,
          })),
          structures: Object.fromEntries(
            ["section", "article", "aside", "table", "form", "button"].map(
              (tag) => [tag, document.querySelectorAll(tag).length],
            ),
          ),
          firstParagraph: document.querySelector("p")
            ? style(document.querySelector("p"))
            : null,
        };
      });
      if (stage.stage === "draft")
        await page.screenshot({
          path: resolve(output, `${record.topic}-draft.png`),
        });
      stages.push({
        stage: stage.stage,
        cssHash: createHash("sha256").update(stage.document.css).digest("hex"),
        visual,
      });
      await page.close();
    }
    results.push({ topic: record.topic, pageId: record.pageId, stages });
  }
} finally {
  await browser.close();
}
await writeFile(
  "../docs/acceptance/design-stages-v9.json",
  JSON.stringify(
    {
      method:
        "Saved responses only. Backend-normalized and fully validated visual shells with entity/state bindings removed and forms assigned inert audit actions. Current CSS math compatibility applies equally to all stages. Offline Chromium; no clicks or model calls. This is a layout attribution audit, not interaction acceptance.",
      results,
    },
    null,
    2,
  ),
);
console.log(
  results.map((r) => ({
    topic: r.topic,
    stages: r.stages.map((s) => ({
      stage: s.stage,
      error: s.error,
      background: s.visual?.body.background,
      h1: s.visual?.headings[0]?.font,
      structures: s.visual?.structures,
    })),
  })),
);
