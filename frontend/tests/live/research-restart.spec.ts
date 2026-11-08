import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { readFile } from "../../tools/local-evidence.mjs";
test("research bookmark retains original page, mode and sources after normal restart", async ({
  page,
  request,
}) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  const evidence = JSON.parse(
    await readFile(
      "../.data/release-archive/docs/acceptance/research-2026-11-05.json",
      "utf8",
    ),
  );
  const saved = evidence.find((r: any) => r.label === "restart-bookmark");
  expect((await (await request.get("/health")).json()).mock).toBe(false);
  const record = await (
    await request.post("/api/getpage", { data: { pageId: saved.pageId } })
  ).json();
  expect(record.page.mode).toBe("research");
  expect(record.page.currentJobId).toBe(saved.jobId);
  expect(record.page.sourceCount).toBe(saved.sourceCount);
  const sources = await (
    await request.post("/api/getpagesources", {
      data: { pageId: saved.pageId },
    })
  ).json();
  expect(sources.sources).toEqual(
    evidence.find((r: any) => r.label === "person").sources,
  );
  let generated = 0;
  page.on("request", (r) => {
    if (/\/api\/(navigate|retrypage|submitpageaction)$/.test(r.url()))
      generated++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "书签", exact: true }).click();
  await page
    .getByRole("button", { name: "打开书签：" + saved.title, exact: true })
    .click();
  await expect(page.frameLocator("iframe").locator("body")).toContainText(
    "袁洋",
  );
  await expect(page.getByRole("combobox", { name: "浏览模式" })).toHaveValue(
    "research",
  );
  await expect(
    page.getByRole("button", { name: "来源 5", exact: true }),
  ).toBeVisible();
  expect(generated).toBe(0);
  await writeFile(
    "../.data/release-archive/docs/acceptance/research-restart-2026-11-05.json",
    JSON.stringify(
      {
        pageId: saved.pageId,
        jobId: saved.jobId,
        mode: record.page.mode,
        sourceCount: record.page.sourceCount,
        generated,
        passed: true,
      },
      null,
      2,
    ),
  );
  await request.post("/api/removebookmark", {
    data: { bookmarkId: saved.bookmarkId },
  });
});
