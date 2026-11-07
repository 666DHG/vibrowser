import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("bookmarks persist, synchronize windows and open cached pages without generation", async ({
  page,
  context,
  request,
}) => {
  expect((await (await request.get("/health")).json()).mock).toBe(true);
  await page.route("**/api/getsettings", (r) =>
    r.fulfill({
      json: {
        baseUrl: "https://api.deepseek.com",
        model: "fixture",
        hasKey: true,
        revision: 1,
      },
    }),
  );
  await page.goto("/");
  await expect(
    page
      .getByRole("combobox", { name: "思考强度" })
      .locator('option[value="deep"]'),
  ).toBeEnabled();
  await page.getByRole("combobox", { name: "思考强度" }).selectOption("deep");
  const input = "bookmarks-" + Date.now() + ".example";
  await page.getByRole("textbox", { name: "网址或搜索词" }).fill(input);
  const navResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/navigate"),
  );
  await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
  const nav = await (await navResponse).json();
  await expect(
    page
      .frameLocator("iframe:visible")
      .getByRole("heading", { name: "月夜树洞" }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "书签", exact: true }).click();
  const savedResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/savebookmark"),
  );
  await page.getByRole("button", { name: "收藏当前网页", exact: true }).click();
  const saved = await (await savedResponse).json();
  try {
    await expect(
      page.getByRole("button", { name: "取消收藏当前网页", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(other.getByText(saved.address, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "书签", exact: true }).click();
    const count = await page.getByRole("tab").count();
    await page.getByRole("button", { name: "书签", exact: true }).click();
    await expect(page.getByRole("tab")).toHaveCount(count);
    await page.getByRole("textbox", { name: "筛选书签" }).fill(input);
    await expect(page.getByText(saved.address, { exact: true })).toBeVisible();
    await mkdir("../docs/screenshots/bookmarks-progress", { recursive: true });
    await page.screenshot({
      path: "../docs/screenshots/bookmarks-progress/bookmarks.png",
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "书签", exact: true }),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "筛选书签" }).fill(input);
    let generations = 0;
    await page
      .getByRole("combobox", { name: "思考强度" })
      .selectOption("standard");
    page.on("request", (r) => {
      if (/\/api\/(navigate|retrypage)$/.test(r.url())) generations++;
    });
    await page
      .getByRole("button", { name: "打开书签：" + saved.title, exact: true })
      .click();
    await expect(page.getByRole("tab")).toHaveCount(count + 1);
    await expect(
      page
        .frameLocator("iframe:visible")
        .getByRole("heading", { name: "月夜树洞" }),
    ).toBeVisible();
    const cached = await (
      await request.post("/api/getpage", {
        data: { pageId: nav.pageId, jobId: null },
      })
    ).json();
    expect(cached.page.currentJobId).toBe(nav.jobId);
    expect(cached.page.effort).toBe("deep");
    await expect(page.getByRole("combobox", { name: "思考强度" })).toHaveValue(
      "deep",
    );
    expect(generations).toBe(0);
    await page
      .getByRole("button", { name: "取消收藏当前网页", exact: true })
      .click();
    await expect(other.getByText(saved.address, { exact: true })).toHaveCount(
      0,
    );
    const after = await (
      await request.post("/api/getpage", {
        data: { pageId: nav.pageId, jobId: null },
      })
    ).json();
    expect(after.page.status).toBe("ready");
    expect(after.page.currentJobId).toBe(nav.jobId);
    await page.getByRole("button", { name: "书签", exact: true }).click();
    await page
      .getByRole("textbox", { name: "筛选书签" })
      .fill("not-found-" + Date.now());
    await expect(page.getByText(saved.address, { exact: true })).toHaveCount(0);
  } finally {
    await request.post("/api/removebookmark", {
      data: { bookmarkId: saved.id },
    });
    await other.close();
  }
});
