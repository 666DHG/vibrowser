import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("review saved v3 pages without generation", async ({ page }) => {
  const records = JSON.parse(
    await readFile("../docs/acceptance/web-documents-2026-11-05.json", "utf8"),
  );
  for (const record of records.filter(
    (r: any) => (r.retests?.at(-1)?.status ?? r.status) === "ready",
  )) {
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
                title: r.title ?? r.input,
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
    const expected = await (
      await page.request.post("/api/getpage", {
        data: { pageId: record.pageId },
      })
    ).json();
    await expect(page.locator("iframe")).toHaveAttribute(
      "title",
      expected.page.document.title,
    );
    await expect
      .poll(
        async () =>
          (await page.frameLocator("iframe").locator("body").innerText())
            .length,
      )
      .toBeGreaterThan(100);
    await expect(page.getByTestId("navigation-progress")).toHaveCount(0);
    await page.screenshot({
      path:
        "../docs/screenshots/web-documents/" +
        record.kind +
        "-" +
        record.variant +
        ".png",
    });
  }
});
