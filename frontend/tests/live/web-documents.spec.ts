import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
test("six v3 live documents", async ({ page, request }) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  expect((await (await request.get("/health")).json()).mock).toBe(false);
  await mkdir("../.data/release-archive/docs/acceptance", { recursive: true });
  await mkdir("../.data/release-archive/docs/screenshots/web-documents", {
    recursive: true,
  });
  const records: any[] = [];
  for (const kind of ["forum", "shop", "docs"] as const) {
    for (let variant = 1; variant <= 2; variant++) {
      const input =
        { forum: "校园树洞论坛", shop: "山间手作商店", docs: "星轨开发文档" }[
          kind
        ] +
        ".com/v3-" +
        variant;
      const begin = Date.now();
      const nav = await (
        await request.post("/api/navigate", {
          data: { input, referrerPageId: null },
        })
      ).json();
      let result: any;
      for (let i = 0; i < 200; i++) {
        result = await (
          await request.post("/api/getpage", { data: { pageId: nav.pageId } })
        ).json();
        if (result.page?.status !== "generating") break;
        await new Promise((r) => setTimeout(r, 750));
      }
      records.push({
        kind,
        variant,
        input,
        pageId: nav.pageId,
        jobId: nav.jobId,
        status: result.page?.status,
        error: result.page?.error,
        title: result.page?.document?.title,
        elapsedMs: Date.now() - begin,
        steps: result.job?.steps,
      });
      await writeFile(
        "../.data/release-archive/docs/acceptance/web-documents-2026-11-05.json",
        JSON.stringify(records, null, 2),
      );
      expect
        .soft(result.page?.status, input + ": " + result.page?.error)
        .toBe("ready");
      if (result.page?.document) {
        await page.goto("/");
        await page.addInitScript(
          ({ id, input }) => {
            sessionStorage.setItem(
              "vibrowser.tabs.v2",
              JSON.stringify({
                activeTabId: "live",
                tabs: [
                  {
                    id: "live",
                    title: input,
                    draft: input,
                    view: "ready",
                    entries: [{ pageId: id, input, address: input }],
                    index: 0,
                  },
                ],
              }),
            );
          },
          { id: nav.pageId, input },
        );
        await page.reload();
        await expect(page.locator("iframe")).toBeVisible();
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
            kind +
            "-" +
            variant +
            ".png",
        });
      }
    }
  }
});
