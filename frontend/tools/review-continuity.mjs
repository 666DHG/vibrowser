import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { measureDocument } from "../dist-measure/measure.mjs";

const root = resolve(import.meta.dirname, "../..");
const input = resolve(root, ".cache/effort-acceptance");
const screenshots = resolve(root, "docs/screenshots/effort-continuity");
const replay = resolve(root, ".cache/effort-continuity-browser");
await mkdir(screenshots, { recursive: true });
await mkdir(replay, { recursive: true });
const results = [];
for (const file of (await readdir(input)).filter((f) =>
  /^calendar-(next|previous)-continuity\.json$/.test(f),
)) {
  const record = JSON.parse(await readFile(resolve(input, file), "utf8"));
  const name = file.slice(0, -5);
  const layout = record.document
    ? await measureDocument(record.document, {
        screenshotPrefix: resolve(screenshots, name),
      })
    : null;
  if (record.document) {
    await writeFile(
      resolve(replay, name + "-new-" + record.effort + ".json"),
      JSON.stringify({
        ...record,
        request: JSON.stringify({ target: { address: record.target } }),
      }),
    );
  }
  results.push({
    name,
    pageId: record.pageId,
    jobId: record.jobId,
    parentPageId: record.parentPageId,
    target: record.target,
    sourceAction: record.sourceAction,
    mode: record.mode,
    effort: record.effort,
    seconds: record.seconds,
    error: record.error,
    inheritedEntityCount: record.inheritedEntityCount,
    factsPreserved: record.factsPreserved,
    brandPreserved: record.brandPreserved,
    siteStyle: record.document?.siteStyle,
    modelCalls: record.modelCalls,
    selection: record.workflow?.selection,
    layout,
  });
}
await writeFile(
  resolve(root, "docs/acceptance/effort-continuity.json"),
  JSON.stringify(
    {
      method:
        "Real NavigateMessage from preserved calendar actions, inherited mode and effort, one bounded generation workflow per direction. Browser replay is separately isolated and does not issue further model calls.",
      expectedSamples: 2,
      complete: results.length === 2,
      samples: results,
    },
    null,
    2,
  ),
);
console.log(
  results.map(({ name, error, factsPreserved, brandPreserved }) => ({
    name,
    error,
    factsPreserved,
    brandPreserved,
  })),
);
