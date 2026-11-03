import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";

async function mockPages(context: BrowserContext) {
  const fixture = JSON.parse(
    await readFile("../contracts/fixtures/valid/magazine.json", "utf8"),
  );
  const navigations: string[] = [];
  const polls: string[] = [];
  const pending = new Set<string>();
  await context.route("**/api/navigate", async (route) => {
    const input = route.request().postDataJSON().input as string;
    navigations.push(input);
    if (input === "delayed.example")
      await new Promise((resolve) => setTimeout(resolve, 1000));
    await route
      .fulfill({
        json: { pageId: input, jobId: "job-" + input, status: "ready" },
      })
      .catch(() => {});
  });
  await context.route("**/api/getpage", async (route) => {
    const input = route.request().postDataJSON().pageId as string;
    polls.push(input);
    const waiting = pending.has(input);
    const spec = {
      ...fixture,
      title: input,
      blocks: fixture.blocks.map((block: { type: string }) =>
        block.type === "navbar" ? { ...block, title: input } : block,
      ),
    };
    await route.fulfill({
      json: {
        page: {
          id: input,
          address: "https://" + input + "/",
          kind: "website",
          prompt: input,
          status: waiting ? "generating" : "ready",
          spec: waiting ? null : spec,
          currentJobId: "job-" + input,
          referrerId: null,
          error: null,
          source: "mock",
        },
        job: waiting
          ? {
              id: "job-" + input,
              pageId: input,
              kind: "page",
              status: "running",
              phase: "generating",
              error: null,
              settingsRevision: 1,
            }
          : null,
      },
    });
  });
  return { navigations, polls, pending };
}
async function navigate(page: Page, input: string) {
  const address = page.getByRole("textbox", { name: "网址或搜索词" });
  await address.fill(input);
  await address.press("Enter");
}
const selected = (page: Page) => page.getByRole("tab", { selected: true });

test("tabs keep independent history, drafts, scroll and restore without new generation", async ({
  page,
  context,
}) => {
  const mock = await mockPages(context);
  await page.goto("/");
  await navigate(page, "alpha.example");
  await expect(
    page.getByRole("tabpanel").locator("[data-page-layout]"),
  ).toBeVisible();
  await page.getByTestId("content-viewport").evaluate((node) => {
    node.scrollTop = 350;
  });
  const savedScroll = await page
    .getByTestId("content-viewport")
    .evaluate((node) => node.scrollTop);
  expect(savedScroll).toBeGreaterThan(0);
  await page
    .getByRole("textbox", { name: "网址或搜索词" })
    .fill("还没提交的草稿");
  await page.getByRole("button", { name: "新建标签页", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "网址或搜索词" }),
  ).toBeFocused();
  await navigate(page, "beta.example");
  await expect(
    page.getByRole("tabpanel").locator("[data-page-layout]"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "后退", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "alpha.example", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "网址或搜索词" })).toHaveValue(
    "还没提交的草稿",
  );
  expect(
    await page
      .getByTestId("content-viewport")
      .evaluate((node) => node.scrollTop),
  ).toBe(savedScroll);
  await navigate(page, "alpha-next.example");
  await expect(
    page.getByRole("tabpanel").locator("[data-page-layout]"),
  ).toBeVisible();
  await page.getByRole("button", { name: "后退", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "网址或搜索词" })).toHaveValue(
    "https://alpha.example/",
  );
  await page.getByRole("button", { name: "前进", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "网址或搜索词" })).toHaveValue(
    "https://alpha-next.example/",
  );
  await page.getByRole("tab", { name: "beta.example", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "后退", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(selected(page)).toHaveText("beta.example");
  await expect(
    page.getByRole("tabpanel").locator("[data-page-layout]"),
  ).toBeVisible();
  expect(mock.navigations).toEqual([
    "alpha.example",
    "beta.example",
    "alpha-next.example",
  ]);
  const brand = (await page.getByTestId("browser-brand").boundingBox())!;
  const tab = (await selected(page).boundingBox())!;
  expect(
    Math.abs(brand.y + brand.height / 2 - tab.y - tab.height / 2),
  ).toBeLessThan(1);
  expect((await page.getByTestId("content-viewport").boundingBox())!.x).toBe(0);
  await mkdir("../docs/screenshots/tabs", { recursive: true });
  await page.screenshot({ path: "../docs/screenshots/tabs/desktop.png" });
  await page
    .getByRole("button", {
      name: "关闭标签页：alpha-next.example",
      exact: true,
    })
    .click();
  await expect(selected(page)).toHaveText("beta.example");
  await page
    .getByRole("button", { name: "关闭标签页：beta.example", exact: true })
    .click();
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(selected(page)).toHaveText("新标签页");
  await expect(
    page.getByRole("heading", { name: /世界还没写好/ }),
  ).toBeVisible();
  await page.reload();
  await expect(selected(page)).toHaveText("新标签页");
});

test("background generation stays with its tab and closing stops polling and late navigation", async ({
  page,
  context,
}) => {
  const mock = await mockPages(context);
  mock.pending.add("slow.example");
  await page.goto("/");
  await navigate(page, "slow.example");
  await expect(
    page.getByRole("heading", { name: "正在加载页面" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "网址或搜索词" })
    .fill("下一个地址的草稿");
  await page.getByRole("button", { name: "新建标签页", exact: true }).click();
  await navigate(page, "fast.example");
  await expect(
    page.getByRole("tabpanel").locator("[data-page-layout]"),
  ).toBeVisible();
  mock.pending.delete("slow.example");
  await expect(
    page.locator('[role="tabpanel"][hidden] [data-page-layout]'),
  ).toHaveCount(1);
  await expect(selected(page)).toHaveText("fast.example");
  await expect(page.getByRole("textbox", { name: "网址或搜索词" })).toHaveValue(
    "https://fast.example/",
  );
  await page.getByRole("tab", { name: "slow.example", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "网址或搜索词" })).toHaveValue(
    "下一个地址的草稿",
  );
  mock.pending.add("waiting.example");
  await navigate(page, "waiting.example");
  await expect(
    page.getByRole("heading", { name: "正在加载页面" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "关闭标签页：waiting.example", exact: true })
    .click();
  const count = mock.polls.filter(
    (input) => input === "waiting.example",
  ).length;
  await page.getByRole("button", { name: "新建标签页", exact: true }).click();
  await navigate(page, "delayed.example");
  await expect
    .poll(() => mock.navigations.includes("delayed.example"))
    .toBe(true);
  await page
    .getByRole("button", { name: "关闭标签页：delayed.example", exact: true })
    .click();
  await page.waitForTimeout(1200);
  expect(mock.polls.filter((input) => input === "waiting.example").length).toBe(
    count,
  );
  expect(mock.polls).not.toContain("delayed.example");
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(selected(page)).toHaveText("fast.example");
});

test("new application windows have separate sessions", async ({
  page,
  context,
}) => {
  await mockPages(context);
  await page.goto("/");
  await navigate(page, "original.example");
  await expect(
    page.getByRole("tabpanel").locator("[data-page-layout]"),
  ).toBeVisible();
  const opened = context.waitForEvent("page");
  await page.getByRole("button", { name: "新建窗口", exact: true }).click();
  const other = await opened;
  await other.waitForLoadState();
  await expect(selected(other)).toHaveText("新标签页");
  await navigate(other, "other-window.example");
  await expect(
    other.getByRole("tabpanel").locator("[data-page-layout]"),
  ).toBeVisible();
  await page.reload();
  await expect(selected(page)).toHaveText("original.example");
  await other.reload();
  await expect(selected(other)).toHaveText("other-window.example");
  await other.close();
  await expect(page.getByRole("tab")).toHaveCount(1);
});

test("many tabs stay reachable on mobile and support keyboard switching", async ({
  page,
  context,
}) => {
  await mockPages(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (let index = 0; index < 7; index++)
    await page.getByRole("button", { name: "新建标签页", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(8);
  await selected(page).focus();
  await selected(page).press("Home");
  await expect(page.getByRole("tab").first()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await selected(page).press("End");
  await expect(page.getByRole("tab").last()).toBeFocused();
  await selected(page).press("Delete");
  await expect(page.getByRole("tab")).toHaveCount(7);
  await expect(selected(page)).toBeFocused();
  const tab = (await selected(page).boundingBox())!;
  expect(tab.x).toBeGreaterThan(0);
  expect(tab.x + tab.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "../docs/screenshots/tabs/mobile.png" });
});
