import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const topics = ["academic", "copy", "calendar", "comparison", "docs", "essay"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
async function read(topic, effort) {
  const directory = `effort-guidance-v8${effort === "deep" ? "-deep" : ""}`;
  try {
    return JSON.parse(
      await readFile(
        resolve(root, `.cache/${directory}/${topic}-new-${effort}.json`),
        "utf8",
      ),
    );
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function summary(record, effort) {
  if (!record) return null;
  assert.equal(record.effort, effort);
  assert(record.guidance.startsWith("8-"));
  assert(record.modelCalls.length > 0);
  for (const call of record.modelCalls) {
    assert.equal(
      call.thinking?.type,
      effort === "deep" ? "enabled" : "disabled",
    );
    assert.equal(
      call.reasoningEffort ?? null,
      effort === "deep" ? "high" : null,
    );
    assert.equal(call.temperature ?? null, null);
    assert.equal(call.maxTokens, effort === "deep" ? 48000 : 24000);
  }
  const usageComplete = record.modelCalls.every(
    (call) => call.usage?.total_tokens != null,
  );
  return {
    pageId: record.pageId,
    jobId: record.jobId,
    ready: !!record.document,
    error: record.error,
    firstGenerationAccepted: record.attempts[0]?.outcome === "Accepted",
    seconds: record.seconds,
    calls: record.modelCalls.length,
    usageComplete,
    totalTokens: usageComplete
      ? record.modelCalls.reduce(
          (sum, call) => sum + call.usage.total_tokens,
          0,
        )
      : null,
    recordedReasoningTokens: record.modelCalls.reduce(
      (sum, call) =>
        sum + (call.usage?.completion_tokens_details?.reasoning_tokens ?? 0),
      0,
    ),
    selection: record.workflow?.selection,
    selectedDirection: record.workflow?.designDirection ?? null,
    htmlUnchangedByReview: record.document
      ? record.document.html === record.workflow?.candidate?.html
      : null,
    cssUnchangedByReview: record.document
      ? record.document.css === record.workflow?.candidate?.css
      : null,
  };
}
const pairs = [];
for (const topic of topics) {
  const standard = await read(topic, "standard");
  const deep = await read(topic, "deep");
  assert(standard, `Missing fixed standard sample: ${topic}`);
  if (deep) {
    assert.equal(
      deep.request,
      standard.request,
      "Input/date/source request changed between efforts",
    );
    assert.equal(
      deep.guidance,
      standard.guidance,
      "Guidance changed between efforts",
    );
    assert.equal(deep.mode, standard.mode);
    assert.equal(deep.input, standard.input);
    assert.deepEqual(
      deep.research?.sources ?? [],
      standard.research?.sources ?? [],
    );
  }
  pairs.push({
    topic,
    requestHash: hash(standard.request),
    paired: !!deep,
    standard: summary(standard, "standard"),
    deep: summary(deep, "deep"),
  });
}
const complete = pairs.every((pair) => pair.paired);
if (process.argv.includes("--complete"))
  assert(complete, "All six pairs required, including failures");
const report = {
  complete,
  plannedPairs: topics.length,
  recordedPairs: pairs.filter((pair) => pair.paired).length,
  scope:
    "Same fixed input, date, retrieval sources and guidance. Effort applies to the entire pipeline, including generated briefs and subsequent visual-reference history; this is not a generation-only causal experiment. No visual quality conclusion is inferred from success counts.",
  pairs,
};
await writeFile(
  resolve(root, "docs/acceptance/effort-guidance-v8-paired.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    complete,
    recordedPairs: report.recordedPairs,
    plannedPairs: report.plannedPairs,
  }),
);
