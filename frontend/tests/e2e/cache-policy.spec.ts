import { test, expect } from "@playwright/test";
test("Chinese display and bookmark-only address reuse", async ({
  page,
  request,
}) => {
  expect((await (await request.get("/health")).json()).mock).toBe(true);
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "网址或搜索词" });
  await input.fill("清华树洞.com/?test=" + Date.now());
  const firstResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/navigate"),
  );
  await input.press("Enter");
  const first = await (await firstResponse).json();
  await expect(page.getByRole("heading", { name: /离地球很远/ })).toBeVisible();
  await expect(input).toHaveValue(/清华树洞\.com/);
  const nextResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/navigate"),
  );
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  const next = await (await nextResponse).json();
  expect(next.pageId).not.toBe(first.pageId);
  await expect(
    page.getByRole("button", { name: "收藏当前网页", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.post("/api/getpage", {
              data: { pageId: next.pageId },
            })
          ).json()
        ).page.status,
    )
    .toBe("ready");
  // Wait for the UI to commit the replacement before bookmarking.
  await expect(page.getByTestId("navigation-progress")).toHaveCount(0);
  await page.getByRole("button", { name: "收藏当前网页", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "取消收藏当前网页", exact: true }),
  ).toBeVisible();
  const savedResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/navigate"),
  );
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  const saved = await (await savedResponse).json();
  expect(saved.pageId).toBe(next.pageId);
  await page
    .getByRole("button", { name: "取消收藏当前网页", exact: true })
    .click();
});
