import { readFile, readdir, mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { measureDocument } from "../dist-measure/measure.mjs";

const root = resolve(import.meta.dirname, "../..");
const input = resolve(root, ".cache/effort-acceptance");
const output = resolve(root, "docs/screenshots/effort-comparison");
await mkdir(output, { recursive: true });
const results = [];
for (const file of (await readdir(input))
  .filter((f) => /-(old-standard|new-standard|new-deep)\.json$/.test(f))
  .sort()) {
  const record = JSON.parse(await readFile(resolve(input, file), "utf8"));
  const name = file.slice(0, -5);
  const measurePath = resolve(output, name + "-measurement.json");
  let layout = null;
  if (record.document) {
    try {
      await access(measurePath);
      layout = JSON.parse(await readFile(measurePath, "utf8"));
    } catch {
      layout = await measureDocument(record.document, {
        screenshotPrefix: resolve(output, name),
      });
      await writeFile(measurePath, JSON.stringify(layout, null, 2));
    }
  }
  results.push({
    name,
    input: record.input,
    mode: record.mode,
    effort: record.effort,
    pageId: record.pageId,
    jobId: record.jobId,
    guidance: record.guidance,
    seconds: record.seconds,
    error: record.error,
    initialGenerationAccepted: record.attempts[0]?.outcome === "Accepted",
    generationAttempts: record.attempts.map(
      ({ output, ...attempt }) => attempt,
    ),
    modelCalls: record.modelCalls,
    selection: record.workflow?.selection,
    events: record.workflow?.events.map(({ output, ...event }) => event),
    sources: record.research?.sources.map(({ excerpt, ...source }) => source),
    researchReused: !name.endsWith("old-standard") && !!record.research,
    siteStyle: record.document?.siteStyle,
    actions: record.document?.actions,
    layout,
  });
  console.log(name, record.error ?? "rendered");
}
if (process.argv.includes("--complete"))
  assert.equal(
    results.length,
    18,
    "All fixed samples must be recorded, including failures",
  );
const groups = Object.fromEntries(
  ["old-standard", "new-standard", "new-deep"].map((variant) => {
    const rows = results.filter((r) => r.name.endsWith(variant));
    return [
      variant,
      {
        samples: rows.length,
        ready: rows.filter((r) => !r.error).length,
        initialGenerationAccepted: rows.filter(
          (r) => r.initialGenerationAccepted,
        ).length,
        modelCalls: rows.reduce((n, r) => n + r.modelCalls.length, 0),
        generationModelCalls: rows.reduce(
          (n, r) =>
            n +
            r.modelCalls.filter((c) => c.stage !== "researchPlanning").length,
          0,
        ),
        recordedTokens: rows.reduce(
          (n, r) =>
            n +
            r.modelCalls.reduce(
              (sum, c) => sum + (c.usage?.total_tokens ?? 0),
              0,
            ),
          0,
        ),
        seconds: rows.reduce((n, r) => n + r.seconds, 0),
      },
    ];
  }),
);
await writeFile(
  resolve(root, "docs/acceptance/effort-comparison.json"),
  JSON.stringify(
    {
      evaluatedAt: new Date().toISOString(),
      expectedSamples: 18,
      complete: results.length === 18,
      groups,
      samples: results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(groups));
