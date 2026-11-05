import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
test("v3 bookmark survives restart without generation", async ({
  page,
  request,
}) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  const path = "../docs/acceptance/web-bookmark-2026-11-05.json";
  const record = JSON.parse(await readFile(path, "utf8"));
  let generated = 0;
  page.on("request", (r) => {
    if (/\/api\/(navigate|submitpageaction|retrypage)$/.test(r.url()))
      generated++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "书签", exact: true }).click();
  await page
    .getByRole("button", {
      name: "打开书签：" + record.bookmark.title,
      exact: true,
    })
    .click();
  await expect(page.locator("iframe")).toHaveAttribute(
    "title",
    record.bookmark.title,
  );
  await expect(
    page
      .frameLocator("iframe")
      .locator('[data-state="' + record.cartKey + '"]')
      .first(),
  ).toHaveText("1");
  const result = await (
    await request.post("/api/getpage", { data: { pageId: record.pageId } })
  ).json();
  expect(result.page.currentJobId).toBe(record.jobId);
  expect(result.page.document.initialState[record.cartKey]).toBe("1");
  expect(generated).toBe(0);
  const initial = JSON.parse(
    await readFile("../docs/acceptance/web-documents-2026-11-05.json", "utf8"),
  );
  const temporary = await request.post("/api/getpage", {
    data: { pageId: initial[0].pageId },
  });
  expect(temporary.status()).toBe(404);
  await writeFile(
    path,
    JSON.stringify(
      {
        ...record,
        restart: {
          passed: true,
          generationRequests: generated,
          jobId: result.page.currentJobId,
          temporaryPageStatus: temporary.status(),
        },
      },
      null,
      2,
    ),
  );
  await expect(page.getByTestId("navigation-progress")).toHaveCount(0);
  await page.screenshot({
    path: "../docs/screenshots/web-documents/bookmark-restart.png",
  });
});
