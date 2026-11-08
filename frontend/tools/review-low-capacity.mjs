import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { measureDocument } from "../dist-measure/measure.mjs";

const root = resolve(import.meta.dirname, "../..");
const record = JSON.parse(
  await readFile(
    resolve(root, ".cache/effort-low-capacity/docs-new-standard.json"),
    "utf8",
  ),
);
const original = JSON.parse(
  await readFile(
    resolve(root, ".cache/effort-guidance-v8-low/docs-new-standard.json"),
    "utf8",
  ),
);
assert(original.error);
assert.equal(record.request, original.request);
assert.deepEqual(record.research, original.research);
assert.deepEqual(record.workflow, original.workflow);
assert.equal(record.databaseUnchanged, true);
assert.equal(record.effortPolicy, "experimental-low-capacity");
assert.equal(record.modelCalls.length, 1);
const call = record.modelCalls[0];
assert.equal(call.maxTokens, 48000);
assert.equal(call.thinking.type, "enabled");
assert.equal(call.reasoningEffort, "low");
const output = resolve(root, "docs/screenshots/effort-low-capacity");
await mkdir(output, { recursive: true });
const layout = record.document
  ? await measureDocument(record.document, {
      screenshotPrefix: resolve(output, "docs-new-standard"),
    })
  : null;
await writeFile(
  resolve(root, "docs/acceptance/effort-low-capacity.json"),
  JSON.stringify(
    {
      method:
        "One saved-input request; no new planning, review, repair or database writes. Original failed batch retained.",
      changes: { maxTokens: [24000, 48000], requestTimeoutSeconds: [180, 600] },
      sourcePageId: record.pageId,
      sourceJobId: record.jobId,
      originalError: original.error,
      error: record.error,
      seconds: record.seconds,
      modelCalls: record.modelCalls,
      layout,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ accepted: !!record.document, seconds: record.seconds }),
);
