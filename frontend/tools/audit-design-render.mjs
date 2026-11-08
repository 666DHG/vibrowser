import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { frameSource } from "../dist-measure/webRuntime.mjs";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve("../.cache/playwright");
const { chromium } = await import("playwright");
const browser = await chromium.launch({ channel: "chromium" });
const revision =
  ["v8", "v7"].find((v) => process.argv.includes(`--guidance-${v}`)) ?? "v3";
const samples = [];
try {
  for (const name of [
    "academic",
    "copy",
    "calendar",
    "comparison",
    "docs",
    "essay",
  ]) {
    const record = JSON.parse(
      await readFile(
        `../.cache/effort-guidance-${revision}/${name}-new-standard.json`,
        "utf8",
      ),
    );
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent(frameSource(record.document, "audit", "auditnonce"));
    await page.evaluate(() => document.fonts.ready);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const elements = [];
    for (const selector of ["h1", "p"]) {
      const { nodeId } = await cdp.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector,
      });
      if (!nodeId) continue;
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", {
        nodeId,
      });
      const computed = await page
        .locator(selector)
        .first()
        .evaluate((e) => {
          const s = getComputedStyle(e);
          return {
            font: s.fontFamily,
            size: s.fontSize,
            color: s.color,
            background: s.backgroundColor,
          };
        });
      elements.push({ selector, computed, fonts });
    }
    samples.push({
      name,
      elements,
      cssUnchangedByReview:
        record.workflow?.candidate?.css === record.document.css,
      htmlUnchangedByReview:
        record.workflow?.candidate?.html === record.document.html,
      selectedDirection: record.workflow?.designDirection ?? null,
      actualSiteStyle: record.document.siteStyle,
      selection: record.workflow?.selection,
      bodyStyle: await page.locator("body").evaluate((e) => {
        const s = getComputedStyle(e);
        return { background: s.backgroundColor, font: s.fontFamily };
      }),
      briefCharacters: JSON.stringify(record.workflow?.brief).length,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  revision === "v3"
    ? "../docs/acceptance/design-render-audit.json"
    : `../docs/acceptance/design-render-audit-${revision}.json`,
  JSON.stringify(
    {
      method: `Preserved ${revision} outputs in the same frameSource HTML/CSS, offline Chromium; computed style and actual platform fonts on first h1/p. No model calls or source edits.`,
      samples,
    },
    null,
    2,
  ),
);
console.log(
  samples.map((s) => ({
    name: s.name,
    fonts: s.elements.flatMap((e) => e.fonts.map((f) => f.familyName)),
    cssUnchangedByReview: s.cssUnchangedByReview,
  })),
);
