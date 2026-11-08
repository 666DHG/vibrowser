import { readFile, readdir, mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { measureDocument } from "../dist-measure/measure.mjs";

const root = resolve(import.meta.dirname, "../..");
const revision = ["v9", "v8", "v7", "v6", "v5", "v4", "v3"].find((v) =>
  process.argv.includes(`--guidance-${v}`),
);
const sampling = process.argv.includes("--sampling-v1");
const deep = process.argv.includes("--deep");
const low = process.argv.includes("--low");
assert(
  !low || (revision === "v8" && !deep && !sampling),
  "Low comparison requires isolated v8",
);
assert(
  !deep || (revision === "v8" && !sampling),
  "Deep comparison requires v8",
);
const retest = revision !== undefined || sampling;
const experiment = sampling
  ? "effort-sampling-v1"
  : "effort-guidance-" + revision + (deep ? "-deep" : low ? "-low" : "");
const expectedSamples = retest ? 6 : 18;
const input = resolve(
  root,
  retest ? ".cache/" + experiment : ".cache/effort-acceptance",
);
const output = resolve(
  root,
  retest
    ? "docs/screenshots/" + experiment
    : "docs/screenshots/effort-comparison",
);
await mkdir(output, { recursive: true });
const results = [];
for (const file of (await readdir(input))
  .filter((f) => /-(old-standard|new-standard|new-deep)\.json$/.test(f))
  .sort()) {
  const record = JSON.parse(await readFile(resolve(input, file), "utf8"));
  if (retest) {
    const baseline = JSON.parse(
      await readFile(
        resolve(
          root,
          ".cache/effort-acceptance",
          file.replace("-new-deep", "-new-standard"),
        ),
        "utf8",
      ),
    );
    assert.equal(
      record.request,
      baseline.request,
      "Guidance retest must preserve the original input and research context",
    );
    assert.equal(record.effort, deep ? "deep" : "standard");
    if (low) assert.equal(record.effortPolicy, "experimental-low");
    if (sampling) {
      assert(record.guidance.startsWith("7-"));
      assert(record.modelCalls.some((call) => call.temperature === 1.3));
      assert(
        record.modelCalls.every((call) =>
          call.stage === "document"
            ? call.temperature === 1.3
            : call.temperature == null,
        ),
      );
    }
  }
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
    effortPolicy: record.effortPolicy ?? "product",
    contentFocusOnly: record.workflow?.contentFocusOnly ?? false,
    draftPlanning: record.workflow?.draftPlanning ?? false,
    draftCharacters: record.workflow?.draft
      ? record.workflow.draft.html.length + record.workflow.draft.css.length
      : 0,
    layoutExploration: record.workflow?.layoutExploration ?? false,
    designDirection: record.workflow?.designDirection ?? null,
    proposedDirectionCount:
      record.workflow?.brief?.visualDirections?.length ?? 0,
    visualReferenceCount: record.workflow?.visualReferences?.length ?? 0,
    visualReferenceCharacters: record.workflow?.visualReferences
      ? JSON.stringify(record.workflow.visualReferences).length
      : 0,
    requestHash: createHash("sha256").update(record.request).digest("hex"),
    actualEffortMatches:
      record.modelCalls.length === 0
        ? null
        : record.modelCalls.every((call) =>
            low
              ? call.thinking?.type === "enabled" &&
                call.reasoningEffort === "low"
              : record.effort === "deep"
                ? call.thinking?.type === "enabled" &&
                  call.reasoningEffort === "high"
                : call.thinking?.type === "disabled" &&
                  call.reasoningEffort == null,
          ),
    pageId: record.pageId,
    jobId: record.jobId,
    guidance: record.guidance,
    briefCharacters: record.workflow?.brief
      ? JSON.stringify(record.workflow.brief).length
      : null,
    earlyVisualPlanCharacters: record.workflow?.brief
      ? (record.workflow.brief.typography ?? "").length +
        (record.workflow.brief.continuity ?? "").length
      : null,
    cssChangedByReview:
      record.document && record.workflow?.candidate
        ? record.document.css !== record.workflow.candidate.css
        : null,
    seconds: record.seconds,
    interrupted: record.interrupted ?? false,
    usageComplete:
      record.usageComplete ??
      record.modelCalls.every((call) => call.usage?.total_tokens != null),
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
    expectedSamples,
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
        interrupted: rows.filter((r) => r.interrupted).length,
        unknownUsageSamples: rows.filter((r) => !r.usageComplete).length,
        unknownDurationSamples: rows.filter((r) => r.seconds == null).length,
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
        recordedCompletionTokens: rows.reduce(
          (n, r) =>
            n +
            r.modelCalls.reduce(
              (sum, c) => sum + (c.usage?.completion_tokens ?? 0),
              0,
            ),
          0,
        ),
        recordedReasoningTokens: rows.reduce(
          (n, r) =>
            n +
            r.modelCalls.reduce(
              (sum, c) =>
                sum +
                (c.usage?.completion_tokens_details?.reasoning_tokens ?? 0),
              0,
            ),
          0,
        ),
        seconds: rows.reduce((n, r) => n + r.seconds, 0),
      },
    ];
  }),
);
const comparability = [...new Set(results.map((r) => r.input))].map((input) => {
  const rows = results.filter((r) => r.input === input);
  return {
    input,
    samples: rows.length,
    allThreePresent: rows.length === 3,
    identicalGenerationRequest:
      new Set(rows.map((r) => r.requestHash)).size === 1,
    actualEffortMatches: rows
      .filter((r) => r.actualEffortMatches != null)
      .every((r) => r.actualEffortMatches),
    unobservedEffortSamples: rows.filter((r) => r.actualEffortMatches == null)
      .length,
  };
});
assert(
  comparability.every(
    (row) => row.identicalGenerationRequest && row.actualEffortMatches,
  ),
  "Comparison inputs or actual effort parameters differ from the declared experiment",
);
await writeFile(
  resolve(
    root,
    retest
      ? "docs/acceptance/" + experiment + ".json"
      : "docs/acceptance/effort-comparison.json",
  ),
  JSON.stringify(
    {
      evaluatedAt: new Date().toISOString(),
      expectedSamples,
      complete: results.length === expectedSamples,
      groups,
      comparability,
      samples: results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(groups));
