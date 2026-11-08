import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { measureDocument } from "../dist-measure/measure.mjs";

const root = resolve(import.meta.dirname, "../..");
const v6 = process.argv.includes("--guidance-v6");
const low = process.argv.includes("--low");
const product = process.argv.includes("--product");
assert(
  [v6, low, product].filter(Boolean).length <= 1,
  "Select one continuity experiment",
);
const variant = product ? "product" : "low";
const reportName =
  low || product
    ? `effort-guidance-v8-${variant}-continuity`
    : v6
      ? "effort-guidance-v6-continuity"
      : "effort-continuity";
const input = resolve(
  root,
  low || product
    ? `.cache/effort-guidance-v8-${variant}`
    : v6
      ? ".cache/effort-guidance-v6"
      : ".cache/effort-acceptance",
);
const screenshots = resolve(root, "docs/screenshots/" + reportName);
const replay = resolve(root, ".cache/" + reportName + "-browser");
await mkdir(screenshots, { recursive: true });
await mkdir(replay, { recursive: true });
const results = [];
for (const file of (await readdir(input)).filter((f) =>
  low || product
    ? f === `comparison-detail-${variant}.json`
    : v6
      ? f === "comparison-detail.json"
      : /^calendar-(next|previous)-continuity\.json$/.test(f),
)) {
  const record = JSON.parse(await readFile(resolve(input, file), "utf8"));
  if (low || product) {
    const parent = JSON.parse(
      await readFile(resolve(input, "comparison-new-standard.json"), "utf8"),
    );
    assert.equal(record.parentPageId, parent.pageId);
    assert.equal(
      record.effortPolicy,
      product ? "product-low-48k" : "experimental-low",
    );
    assert.equal(record.effort, parent.effort);
    assert.equal(
      record.workflow.guidanceVersion,
      parent.workflow.guidanceVersion,
    );
    assert.equal(record.workflow.layoutExploration, false);
    assert(
      record.modelCalls.every(
        (call) =>
          call.thinking?.type === "enabled" &&
          call.reasoningEffort === "low" &&
          call.maxTokens === (product ? 48000 : 24000),
      ),
    );
  }
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
    effortPolicy: record.effortPolicy ?? "product",
    layoutExploration: record.workflow?.layoutExploration ?? null,
    seconds: record.seconds,
    error: record.error,
    inheritedEntityCount: record.inheritedEntityCount,
    factsPreserved: record.factsPreserved,
    brandDescriptionExactMatch: record.brandPreserved,
    siteStyle: record.document?.siteStyle,
    modelCalls: record.modelCalls,
    selection: record.workflow?.selection,
    visualReferences: record.workflow?.visualReferences ?? null,
    layout,
  });
}
await writeFile(
  resolve(root, "docs/acceptance/" + reportName + ".json"),
  JSON.stringify(
    {
      method:
        "Real NavigateMessage from preserved page actions, inherited mode and effort, one bounded workflow per selected target. Brand comparison is exact descriptive-string equality, not a visual identity verdict. Browser replay is separately isolated and does not issue further model calls.",
      expectedSamples: v6 || low || product ? 1 : 2,
      complete: results.length === (v6 || low || product ? 1 : 2),
      samples: results,
    },
    null,
    2,
  ),
);
console.log(
  results.map(
    ({ name, error, factsPreserved, brandDescriptionExactMatch }) => ({
      name,
      error,
      factsPreserved,
      brandDescriptionExactMatch,
    }),
  ),
);
