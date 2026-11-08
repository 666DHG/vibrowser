import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "./local-evidence.mjs";
import { resolve } from "node:path";
import { measureDocument } from "../dist-measure/measure.mjs";

const root = resolve(import.meta.dirname, "../..");
const result = JSON.parse(
  await readFile(resolve(root, ".cache/summary-binding-replay.json"), "utf8"),
);
const original = JSON.parse(
  await readFile(
    resolve(root, ".cache/effort-guidance-v4/copy-new-standard.json"),
    "utf8",
  ),
);
const raw = JSON.parse(
  original.attempts.find((a) => a.outcome === "Accepted").output,
);
const screenshots = resolve(
  root,
  ".data/release-archive/docs/screenshots/summary-binding-repair",
);
const replay = resolve(root, ".cache/summary-binding-browser");
await mkdir(screenshots, { recursive: true });
await mkdir(replay, { recursive: true });
const layout = result.document
  ? await measureDocument(result.document, {
      screenshotPrefix: resolve(screenshots, "copy"),
    })
  : null;
if (result.document)
  await writeFile(
    resolve(replay, "copy-new-standard.json"),
    JSON.stringify({
      ...original,
      document: result.document,
      error: result.error,
    }),
  );
const report = {
  method:
    "One repair request using the original accepted raw response and the new binding diagnostic. No new brief, search, review, or reroll; original database page is unchanged. All eight original copy paragraphs are checked verbatim in the validated result.",
  pageId: result.pageId,
  jobId: result.jobId,
  guardError: result.guardError,
  seconds: result.seconds,
  modelCalls: result.modelCalls,
  originalParagraphs: result.originalParagraphs,
  preservedParagraphs: result.preservedParagraphs,
  cssUnchanged: result.document ? raw.css === result.document.css : null,
  error: result.error,
  storedPagesChanged: result.storedPagesChanged,
  layout,
};
await writeFile(
  resolve(
    root,
    ".data/release-archive/docs/acceptance/summary-binding-repair.json",
  ),
  JSON.stringify(report, null, 2),
);
console.log({
  error: report.error,
  paragraphs: `${report.preservedParagraphs}/${report.originalParagraphs}`,
  cssUnchanged: report.cssUnchanged,
  calls: report.modelCalls.length,
});
