import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { measureDocument } from "../dist-measure/measure.mjs";

const root = resolve(import.meta.dirname, "../..");
const input = resolve(root, ".cache/effort-budget-replay");
const replay = resolve(root, ".cache/effort-budget-browser");
const screenshots = resolve(root, "docs/screenshots/effort-budget-replay");
await mkdir(replay, { recursive: true });
await mkdir(screenshots, { recursive: true });
const rows = [];
for (const file of (await readdir(input))
  .filter((f) => f.endsWith("-new-deep.json"))
  .sort()) {
  const record = JSON.parse(await readFile(resolve(input, file), "utf8"));
  const original = JSON.parse(
    await readFile(resolve(root, ".cache/effort-acceptance", file), "utf8"),
  );
  const name = file.slice(0, -5);
  const layout = record.document
    ? await measureDocument(record.document, {
        screenshotPrefix: resolve(screenshots, name),
      })
    : null;
  if (record.document) {
    await writeFile(
      resolve(replay, file),
      JSON.stringify({
        ...original,
        document: record.document,
        error: record.error,
      }),
    );
  }
  rows.push({
    sample: record.sample,
    originalPageId: record.originalPageId,
    originalJobId: record.originalJobId,
    seconds: record.seconds,
    error: record.error,
    modelCalls: record.modelCalls,
    storedPagesChanged: record.storedPagesChanged,
    layout,
  });
}
await writeFile(
  resolve(root, "docs/acceptance/effort-budget-replay.json"),
  JSON.stringify(
    {
      method:
        "One same-input generation per observed truncation case, original v2 guidance, 48000 output cap. No review, reroll, or stored page replacement. Browser replay uses isolated fixtures, not database persistence.",
      expectedSamples: 2,
      complete: rows.length === 2,
      samples: rows,
    },
    null,
    2,
  ),
);
console.log(
  rows.map((r) => ({
    sample: r.sample,
    accepted: r.error == null,
    calls: r.modelCalls.length,
  })),
);
