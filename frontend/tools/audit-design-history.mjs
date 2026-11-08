import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { readFile } from "./local-evidence.mjs";
import { resolve } from "node:path";
import { frameSource } from "../dist-measure/webRuntime.mjs";
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve("../.cache/playwright");
const { chromium } = await import("playwright");
const rows = JSON.parse(
  await readFile("../.cache/recent-design-history.json", "utf8"),
);
const recent = rows.filter((r) => r.design_workflow);
const summary = recent.map((r) => ({
  pageId: r.id,
  jobId: r.job_id,
  input: r.prompt,
  at: r.created_at,
  parent: r.referrer_id,
  selection: r.design_workflow.selection,
  originalUnchanged:
    r.document.html === r.design_workflow.candidate.html &&
    r.document.css === r.design_workflow.candidate.css,
  originalStyle: r.design_workflow.candidate.siteStyle,
  finalStyle: r.document.siteStyle,
  failures: r.design_workflow.events
    .filter((e) => e.status === "Failed")
    .map(({ stage, message }) => ({ stage, message })),
}));
const row = recent.find((r) => r.id === "587960b4-a6b3-4891-a334-9ba64d07a94b");
assert(row, "The fixed recent copy-button sample must be available");
const action = row.document.actions.find((a) => a.elementId === "sample-copy");
assert.equal(action.kind, "Set");
const browser = await chromium.launch({ channel: "chromium", headless: true });
let evidence;
try {
  const page = await browser.newPage();
  await page.route("**/*", (r) => r.abort());
  await page.setContent(
    '<iframe sandbox="allow-scripts allow-forms" style="width:100%;height:800px"></iframe>',
  );
  const instance = crypto.randomUUID();
  await page.evaluate(
    ({ source, instance }) => {
      window.auditMessages = [];
      window.addEventListener("message", (e) => {
        if (
          e.source === document.querySelector("iframe").contentWindow &&
          e.data?.instance === instance
        )
          window.auditMessages.push(e.data);
      });
      document.querySelector("iframe").srcdoc = source;
    },
    {
      source: frameSource(row.document, instance, crypto.randomUUID()),
      instance,
    },
  );
  await page.waitForFunction(() =>
    window.auditMessages.some((m) => m.type === "ready"),
  );
  const frame = page.frames().find((f) => f.parentFrame());
  // Observe clipboard API use inside this isolated test frame without touching the user's clipboard.
  await frame.evaluate(() => {
    window.auditClipboardWrites = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.auditClipboardWrites.push(text);
        },
        write: async () => {
          window.auditClipboardWrites.push("binary");
        },
      },
    });
    const original = document.execCommand.bind(document);
    document.execCommand = (name, ...args) => {
      if (name === "copy") window.auditClipboardWrites.push("legacy");
      return name === "copy" ? true : original(name, ...args);
    };
  });
  await frame.locator('[id="sample-copy"]').click();
  await page.waitForFunction(
    ({ key, value }) =>
      window.auditMessages.some(
        (m) => m.type === "state" && m.state[key] === value,
      ),
    { key: action.stateKey, value: action.value },
  );
  evidence = {
    pageId: row.id,
    actionId: action.id,
    declaredKind: action.kind,
    displayedText: await frame.locator('[data-state="copyHint"]').innerText(),
    clipboardWrites: await frame.evaluate(
      () => window.auditClipboardWrites.length,
    ),
    serverActions: await page.evaluate(
      () => window.auditMessages.filter((m) => m.type === "action").length,
    ),
  };
  assert.equal(evidence.clipboardWrites, 0);
  assert.equal(evidence.displayedText, action.value);
  assert.equal(evidence.serverActions, 0);
} finally {
  await browser.close();
}
await mkdir("../.data/release-archive/docs/acceptance", { recursive: true });
await writeFile(
  "../.data/release-archive/docs/acceptance/design-baseline-2026-11-07.json",
  JSON.stringify(
    {
      evaluatedAt: new Date().toISOString(),
      purpose: "Baseline reproduction, not a passing copy feature",
      samples: summary,
      copyEvidence: evidence,
      modelRequests: 0,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    samples: summary.length,
    unchanged: summary.filter((r) => r.originalUnchanged).length,
    copyEvidence: evidence,
    modelRequests: 0,
  }),
);
