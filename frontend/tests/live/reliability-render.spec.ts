import { test, expect } from "@playwright/test";
import { readFile } from "../../tools/local-evidence.mjs";

test("render reliability acceptance pages without regeneration", async ({
  browser,
  request,
}) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  const rows = JSON.parse(
    await readFile(
      "../.data/release-archive/docs/acceptance/reliability-retest-2026-11-05.json",
      "utf8",
    ),
  );
  for (const row of rows) {
    const record = (
      await (
        await request.post("/api/getpage", { data: { pageId: row.pageId } })
      ).json()
    ).page;
    expect(record.status).toBe("ready");
    const page = await browser.newPage();
    let generated = 0;
    page.on("request", (r) => {
      if (/\/api\/(navigate|retrypage|submitpageaction)$/.test(r.url()))
        generated++;
    });
    await page.addInitScript(
      (r) =>
        sessionStorage.setItem(
          "vibrowser.tabs.v2",
          JSON.stringify({
            activeTabId: "review",
            tabs: [
              {
                id: "review",
                title: r.document.title,
                draft: r.prompt,
                view: "ready",
                browsingMode: r.mode,
                entries: [
                  {
                    pageId: r.id,
                    input: r.prompt,
                    address: r.address,
                    browsingMode: r.mode,
                  },
                ],
                index: 0,
              },
            ],
          }),
        ),
      record,
    );
    await page.goto("/");
    await expect(
      page.frameLocator("iframe").locator("h1").first(),
    ).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({
      path:
        "../.data/release-archive/docs/screenshots/reliability/" +
        (row.label === "fresh-person-after-fix"
          ? "person-after-fix"
          : row.label) +
        ".png",
    });
    expect(generated).toBe(0);
    await page.close();
  }
});
