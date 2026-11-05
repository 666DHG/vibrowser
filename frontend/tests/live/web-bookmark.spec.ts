import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
test("real cached product local actions and bookmark snapshot", async ({
  page,
  request,
}) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  const records = JSON.parse(
    await readFile(
      "../docs/acceptance/web-interactions-2026-11-05.json",
      "utf8",
    ),
  );
  const record = [...records]
    .reverse()
    .find((r: any) => r.title?.includes("灰釉茶碗") && r.status === "ready");
  const result = await (
    await request.post("/api/getpage", { data: { pageId: record.pageId } })
  ).json();
  const doc = result.page.document;
  await page.goto("/");
  await page.addInitScript(
    (r) =>
      sessionStorage.setItem(
        "vibrowser.tabs.v2",
        JSON.stringify({
          activeTabId: "product",
          tabs: [
            {
              id: "product",
              title: r.document.title,
              draft: r.address,
              view: "ready",
              entries: [{ pageId: r.id, input: r.address, address: r.address }],
              index: 0,
            },
          ],
        }),
      ),
    result.page,
  );
  await page.reload();
  const frame = page.frameLocator("iframe");
  const increment = doc.actions.find((a: any) => a.kind === "Increment");
  const set = doc.actions.filter((a: any) => a.kind === "Set").at(-1);
  await expect(frame.locator("#" + increment.elementId)).toBeVisible();
  let generates = 0;
  page.on("request", (r) => {
    if (/\/api\/(navigate|submitpageaction|retrypage)$/.test(r.url()))
      generates++;
  });
  await frame.locator("#" + set.elementId).click();
  await frame.locator("#" + increment.elementId).click();
  await expect(
    frame
      .locator('[data-state="' + increment.stateKey + '"]')
      .filter({ hasNot: frame.locator("button") }),
  ).toContainText("1");
  const saved = page.waitForResponse((r) =>
    r.url().endsWith("/api/savebookmark"),
  );
  await page.getByRole("button", { name: "收藏当前网页", exact: true }).click();
  const bookmark = await (await saved).json();
  const reopened = await (
    await request.post("/api/getpage", { data: { pageId: record.pageId } })
  ).json();
  expect(reopened.page.document.initialState[increment.stateKey]).toBe("1");
  expect(generates).toBe(0);
  await writeFile(
    "../docs/acceptance/web-bookmark-2026-11-05.json",
    JSON.stringify(
      {
        pageId: record.pageId,
        jobId: result.page.currentJobId,
        bookmark,
        cartKey: increment.stateKey,
        state: reopened.page.document.initialState,
        localGenerationRequests: generates,
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: "../docs/screenshots/web-documents/shop-interaction.png",
  });
});
