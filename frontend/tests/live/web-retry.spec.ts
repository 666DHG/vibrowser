import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { readFile } from "../../tools/local-evidence.mjs";
test("retry failed v3 acceptance cases after fixes", async ({
  request,
  page,
}) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  const path =
    "../.data/release-archive/docs/acceptance/web-documents-2026-11-05.json";
  const records = JSON.parse(await readFile(path, "utf8"));
  for (const record of records) {
    let result = await (
      await request.post("/api/getpage", { data: { pageId: record.pageId } })
    ).json();
    if (result.page.status === "failed") {
      const begin = Date.now();
      const retry = await (
        await request.post("/api/retrypage", {
          data: {
            pageId: record.pageId,
            failedJobId: result.page.currentJobId,
          },
        })
      ).json();
      for (let i = 0; i < 200; i++) {
        result = await (
          await request.post("/api/getpage", {
            data: { pageId: record.pageId },
          })
        ).json();
        if (result.page.status !== "generating") break;
        await new Promise((r) => setTimeout(r, 750));
      }
      record.retests ??= [];
      record.retests.push({
        jobId: retry.jobId,
        status: result.page.status,
        error: result.page.error,
        steps: result.job.steps,
        elapsedMs: Date.now() - begin,
      });
      await writeFile(path, JSON.stringify(records, null, 2));
    }
    expect
      .soft(result.page.status, record.input + ": " + result.page.error)
      .toBe("ready");
    if (result.page.document) {
      await page.goto("/");
      await page.addInitScript(
        (r) =>
          sessionStorage.setItem(
            "vibrowser.tabs.v2",
            JSON.stringify({
              activeTabId: "review",
              tabs: [
                {
                  id: "review",
                  title: r.input,
                  draft: r.input,
                  view: "ready",
                  entries: [
                    { pageId: r.pageId, input: r.input, address: r.input },
                  ],
                  index: 0,
                },
              ],
            }),
          ),
        record,
      );
      await page.reload();
      await expect
        .poll(
          async () =>
            (await page.frameLocator("iframe").locator("body").innerText())
              .length,
        )
        .toBeGreaterThan(100);
      await page.screenshot({
        path:
          "../.data/release-archive/docs/screenshots/web-documents/" +
          record.kind +
          "-" +
          record.variant +
          ".png",
      });
    }
  }
});
