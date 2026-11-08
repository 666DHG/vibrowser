import { test, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { readFile } from "../../tools/local-evidence.mjs";
import { createHash } from "node:crypto";
const temporary = "../.data/bookmarks-live-evidence.json";
const hash = (spec: unknown) =>
  createHash("sha256").update(JSON.stringify(spec)).digest("hex");
test.beforeEach(async ({ request }) => {
  test.skip(
    process.env.VIBROWSER_LIVE_SMOKE !== "true",
    "Explicit real-cache acceptance opt-in required",
  );
  expect((await (await request.get("/health")).json()).mock).toBe(false);
});
test("prepare a real cached bookmark before restart", async ({
  page,
  request,
}) => {
  const sample = JSON.parse(
    await readFile(
      "../.data/release-archive/docs/acceptance/layout-generation-2026-11-03.json",
      "utf8",
    ),
  )[0];
  const record = (
    await (
      await request.post("/api/getpage", {
        data: { pageId: sample.pageId, jobId: null },
      })
    ).json()
  ).page;
  expect(record.status).toBe("ready");
  expect(record.currentJobId).toBe(sample.jobId);
  const initial = (
    await (await request.post("/api/listbookmarks", { data: {} })).json()
  ).bookmarks;
  let bookmark = initial.find(
    (b: { pageId: string }) => b.pageId === sample.pageId,
  );
  const createdByTest = !bookmark;
  await page.goto("/");
  const navResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/navigate"),
  );
  await page.getByRole("textbox", { name: "网址或搜索词" }).fill(sample.input);
  await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
  const nav = await (await navResponse).json();
  expect(nav.status).toBe("ready");
  expect(nav.jobId).toBe(sample.jobId);
  await expect(
    page.getByTestId("content-viewport").locator("[data-page-layout]"),
  ).toBeVisible();
  if (!bookmark) {
    const save = page.waitForResponse((r) =>
      r.url().endsWith("/api/savebookmark"),
    );
    await page
      .getByRole("button", { name: "收藏当前网页", exact: true })
      .click();
    bookmark = await (await save).json();
  }
  await expect(
    page.getByRole("button", { name: "取消收藏当前网页", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "书签", exact: true }).click();
  await expect(page.getByText(record.address, { exact: true })).toBeVisible();
  await mkdir("../.data/release-archive/docs/screenshots/bookmarks-progress", {
    recursive: true,
  });
  await page.screenshot({
    path: "../.data/release-archive/docs/screenshots/bookmarks-progress/live-bookmark.png",
  });
  await writeFile(
    temporary,
    JSON.stringify(
      {
        preparedAt: new Date().toISOString(),
        pageId: sample.pageId,
        jobId: sample.jobId,
        hash: hash(record.spec),
        bookmark,
        createdByTest,
      },
      null,
      2,
    ),
  );
});

test("restore the bookmark after restart and reopen without generation", async ({
  page,
  request,
}) => {
  const evidence = JSON.parse(await readFile(temporary, "utf8"));
  const list = (
    await (await request.post("/api/listbookmarks", { data: {} })).json()
  ).bookmarks;
  expect(
    list.find((b: { id: string }) => b.id === evidence.bookmark.id),
  ).toEqual(evidence.bookmark);
  let generationRequests = 0;
  page.on("request", (r) => {
    if (/\/api\/(navigate|retrypage)$/.test(r.url())) generationRequests++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "书签", exact: true }).click();
  await page
    .getByRole("textbox", { name: "筛选书签" })
    .fill(evidence.bookmark.address);
  await page
    .getByRole("button", {
      name: "打开书签：" + evidence.bookmark.title,
      exact: true,
    })
    .click();
  await expect(
    page.getByTestId("content-viewport").locator("[data-page-layout]"),
  ).toBeVisible();
  const record = (
    await (
      await request.post("/api/getpage", {
        data: { pageId: evidence.pageId, jobId: null },
      })
    ).json()
  ).page;
  expect(record.currentJobId).toBe(evidence.jobId);
  expect(hash(record.spec)).toBe(evidence.hash);
  expect(generationRequests).toBe(0);
  await page.screenshot({
    path: "../.data/release-archive/docs/screenshots/bookmarks-progress/live-reopened.png",
  });
  if (evidence.createdByTest) {
    await page
      .getByRole("button", { name: "取消收藏当前网页", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "收藏当前网页", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  }
  await mkdir("../.data/release-archive/docs/acceptance", { recursive: true });
  await writeFile(
    "../.data/release-archive/docs/acceptance/bookmarks-progress-2026-11-03.json",
    JSON.stringify(
      {
        ...evidence,
        verifiedAt: new Date().toISOString(),
        generationRequestsDuringReopen: generationRequests,
        persistedAcrossRestart: true,
        cachedContentUnchanged: true,
        testBookmarkRemoved: evidence.createdByTest,
        newModelCalls: 0,
      },
      null,
      2,
    ),
  );
});
