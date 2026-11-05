import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { measureDocument } from "../dist-measure/measure.mjs";

const input = resolve("../.cache/design-acceptance");
const output = resolve("../docs/screenshots/design-workflow");
await mkdir(output, { recursive: true });
const results = [];
for (const file of (await readdir(input)).filter((f) => f.endsWith(".json"))) {
  const record = JSON.parse(await readFile(resolve(input, file), "utf8"));
  const name = file.replace(/\.json$/, "");
  const layout = record.document
    ? await measureDocument(record.document, {
        screenshotPrefix: resolve(output, name),
      })
    : null;
  results.push({
    name,
    input: record.input,
    mode: record.mode,
    pageId: record.pageId,
    jobId: record.jobId,
    seconds: record.seconds,
    error: record.error,
    generationRequests: record.attempts.length,
    designRequests:
      record.workflow?.events.filter(
        (e) =>
          ["Brief", "Review", "Improve"].includes(e.stage) &&
          e.status === "Started",
      ).length ?? 0,
    researchRequests: record.research && {
      search: record.research.searchRequests,
      fetch: record.research.fetchRequests,
      planning: record.research.planningRequests,
      reused: name.endsWith("-new"),
    },
    selection: record.workflow?.selection,
    guidanceVersion: record.workflow?.guidanceVersion,
    generationOutcomes: record.attempts.map(
      ({ output, ...attempt }) => attempt,
    ),
    continuity: record.parentPageId
      ? {
          parentPageId: record.parentPageId,
          factsPreserved: record.factsPreserved,
          brandPreserved: record.brandPreserved,
        }
      : undefined,
    events: record.workflow?.events.map(({ output, ...event }) => event),
    sources: record.research?.sources.map(({ excerpt, ...source }) => source),
    actions: record.document?.actions,
    layout,
  });
  console.log(name, record.error ?? "rendered");
}
await writeFile(
  resolve(output, "results.json"),
  JSON.stringify(results, null, 2),
);
