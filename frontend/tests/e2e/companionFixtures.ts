import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
export async function setup(page: Page) {
  const spec = JSON.parse(
    await readFile("../contracts/fixtures/valid/magazine.json", "utf8"),
  );
  const state = {
    phase: "generating",
    failed: false,
    ready: false,
    navigations: [] as string[],
    retries: 0,
    extraSteps: [] as string[],
  };
  await page.route("**/api/navigate", (route) => {
    const input = route.request().postDataJSON().input;
    state.navigations.push(input);
    return route.fulfill({
      json: {
        pageId: input,
        jobId: "job-" + input,
        status: input.startsWith("slow") ? "generating" : "ready",
      },
    });
  });
  await page.route("**/api/retrypage", (route) => {
    state.failed = false;
    state.phase = "repairing";
    state.retries++;
    return route.fulfill({
      json: {
        pageId: route.request().postDataJSON().pageId,
        jobId: "retry-job",
        status: "generating",
      },
    });
  });
  await page.route("**/api/getpage", (route) => {
    const id = route.request().postDataJSON().pageId;
    const slow = id.startsWith("slow");
    const ready = !slow || state.ready;
    const phases = state.extraSteps.length
      ? state.extraSteps
      : [
          "queued",
          "preparing",
          "generating",
          ...(state.phase === "generating" ? [] : [state.phase]),
        ];
    return route.fulfill({
      json: {
        page: {
          id,
          address: "https://" + id + "/",
          kind: "website",
          prompt: id,
          status: ready ? "ready" : state.failed ? "failed" : "generating",
          spec: ready
            ? {
                ...spec,
                title: id,
                blocks: spec.blocks.map((b: { type: string }) =>
                  b.type === "navbar" ? { ...b, title: id } : b,
                ),
              }
            : null,
          currentJobId: "job-" + id,
          referrerId: null,
          error: state.failed ? "测试生成失败" : null,
          source: "mock",
        },
        job: slow
          ? {
              id: "job-" + id,
              pageId: id,
              kind: "page",
              status: ready ? "succeeded" : state.failed ? "failed" : "running",
              phase: ready ? "ready" : state.phase,
              error: null,
              settingsRevision: 1,
              steps: phases.map((phase, i) => ({
                phase,
                attempt: phase === "repairing" ? 2 : 1,
                at: new Date(Date.now() - (4 - i) * 1000).toISOString(),
              })),
            }
          : null,
      },
    });
  });
  return state;
}
export async function navigate(page: Page, input: string) {
  await page.getByRole("textbox", { name: "网址或搜索词" }).fill(input);
  await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
}
