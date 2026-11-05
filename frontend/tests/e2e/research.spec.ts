import { test, expect } from "@playwright/test";
test("research sources, bookmarked mode and local actions survive navigation", async ({
  page,
  request,
}) => {
  test.skip(process.env.VIBROWSER_V3_MOCK_SMOKE !== "true");
  expect((await (await request.get("/health")).json()).mock).toBe(true);
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "浏览模式" })
    .selectOption("research");
  const input = page.getByRole("textbox", { name: "网址或搜索词" });
  await input.fill("清华大学.example/" + Date.now());
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/navigate"),
  );
  await input.press("Enter");
  const nav = await (await response).json();
  await expect(page.locator("iframe")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "来源 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "来源 1", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "网页来源" }),
  ).toContainText("清华大学");
  await expect(page.getByRole("link", { name: "查看原文" })).toHaveAttribute(
    "href",
    "https://www.tsinghua.edu.cn/",
  );
  await page.getByRole("button", { name: "关闭来源" }).click();
  const save = page.waitForResponse((r) =>
    r.url().endsWith("/api/savebookmark"),
  );
  await page.getByRole("button", { name: "收藏当前网页", exact: true }).click();
  const bookmark = await (await save).json();
  expect(bookmark.mode).toBe("research");
  await page
    .getByRole("combobox", { name: "浏览模式" })
    .selectOption("imagination");
  const next = page.waitForResponse((r) => r.url().endsWith("/api/navigate"));
  await input.press("Enter");
  const other = await (await next).json();
  expect(other.pageId).not.toBe(nav.pageId);
  await expect
    .poll(async () => {
      const r = await (
        await request.post("/api/getpage", { data: { pageId: other.pageId } })
      ).json();
      return r.page.status;
    })
    .toBe("ready");
  const sources = await (
    await request.post("/api/getpagesources", {
      data: { pageId: other.pageId },
    })
  ).json();
  expect(sources.sources).toEqual([]);
  await page.getByRole("button", { name: "书签", exact: true }).click();
  await page
    .getByRole("button", { name: "打开书签：" + bookmark.title, exact: true })
    .click();
  await expect(page.getByRole("combobox", { name: "浏览模式" })).toHaveValue(
    "research",
  );
  await expect(
    page.getByRole("button", { name: "来源 1", exact: true }),
  ).toBeVisible();
  await request.post("/api/removebookmark", {
    data: { bookmarkId: bookmark.id },
  });
});
