import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";

async function setup(page: Page) {
  const spec = JSON.parse(
    await readFile("../contracts/fixtures/valid/magazine.json", "utf8"),
  );
  const state = {
    phase: "generating",
    failed: false,
    ready: false,
    navigations: [] as string[],
    retries: 0,
    extraSteps: [] as string[],
  };
  await page.route("**/api/navigate", (route) => {
    const input = route.request().postDataJSON().input;
    state.navigations.push(input);
    return route.fulfill({
      json: {
        pageId: input,
        jobId: "job-" + input,
        status: input.startsWith("slow") ? "generating" : "ready",
      },
    });
  });
  await page.route("**/api/retrypage", (route) => {
    state.failed = false;
    state.phase = "repairing";
    state.retries++;
    return route.fulfill({
      json: {
        pageId: route.request().postDataJSON().pageId,
        jobId: "retry-job",
        status: "generating",
      },
    });
  });
  await page.route("**/api/getpage", (route) => {
    const id = route.request().postDataJSON().pageId;
    const slow = id.startsWith("slow");
    const ready = !slow || state.ready;
    const phases = state.extraSteps.length
      ? state.extraSteps
      : [
          "queued",
          "preparing",
          "generating",
          ...(state.phase === "generating" ? [] : [state.phase]),
        ];
    return route.fulfill({
      json: {
        page: {
          id,
          address: "https://" + id + "/",
          kind: "website",
          prompt: id,
          status: ready ? "ready" : state.failed ? "failed" : "generating",
          spec: ready
            ? {
                ...spec,
                title: id,
                blocks: spec.blocks.map((b: { type: string }) =>
                  b.type === "navbar" ? { ...b, title: id } : b,
                ),
              }
            : null,
          currentJobId: "job-" + id,
          referrerId: null,
          error: state.failed ? "测试生成失败" : null,
          source: "mock",
        },
        job: slow
          ? {
              id: "job-" + id,
              pageId: id,
              kind: "page",
              status: ready ? "succeeded" : state.failed ? "failed" : "running",
              phase: ready ? "ready" : state.phase,
              error: null,
              settingsRevision: 1,
              steps: phases.map((phase, i) => ({
                phase,
                attempt: phase === "repairing" ? 2 : 1,
                at: new Date(Date.now() - (4 - i) * 1000).toISOString(),
              })),
            }
          : null,
      },
    });
  });
  return state;
}
async function navigate(page: Page, input: string) {
  await page.getByRole("textbox", { name: "网址或搜索词" }).fill(input);
  await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
}
test("retained page, fixed step panel, failure, retry and history commit", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/");
  await navigate(page, "old.example");
  const content = page.getByTestId("content-viewport");
  await expect(content.locator("[data-page-layout]")).toBeVisible();
  await content.evaluate((n) => {
    n.scrollTop = 100;
  });
  const scroll = await content.evaluate((n) => n.scrollTop);
  await navigate(page, "slow.example");
  const panel = page.getByTestId("navigation-progress");
  await expect(
    panel.getByRole("heading", { name: "正在加载页面" }),
  ).toBeVisible();
  await expect(content.locator("[data-page-layout]")).toBeVisible();
  expect(await content.evaluate((n) => n.scrollTop)).toBe(scroll);
  await expect(page.getByRole("tab", { selected: true })).toHaveText(
    "old.example",
  );
  await panel.evaluate((node) =>
    Promise.all(node.getAnimations().map((animation) => animation.finished)),
  );
  const y = (await panel.boundingBox())!.y;
  await content.evaluate((n) => {
    n.scrollTop += 50;
  });
  expect((await panel.boundingBox())!.y).toBe(y);
  state.phase = "validating";
  await expect(
    panel.getByRole("heading", { name: "正在整理内容" }),
  ).toBeVisible();
  await expect(panel.getByRole("list", { name: "加载步骤" })).toContainText(
    "准备页面",
  );
  await mkdir("../docs/screenshots/bookmarks-progress", { recursive: true });
  await page.screenshot({
    path: "../docs/screenshots/bookmarks-progress/loading.png",
  });
  await panel.getByRole("button", { name: "折叠加载进度" }).click();
  await expect(panel.getByRole("list")).toHaveCount(0);
  await panel.getByRole("button", { name: "展开加载进度" }).click();
  state.failed = true;
  await expect(panel.getByRole("alert")).toHaveText("测试生成失败");
  await expect(
    page.getByRole("button", { name: "后退", exact: true }),
  ).toBeDisabled();
  await expect(content.locator("[data-page-layout]")).toBeVisible();
  await panel.getByRole("button", { name: "重新尝试", exact: true }).click();
  await expect(
    panel.getByRole("heading", { name: "正在修复页面" }),
  ).toBeVisible();
  await expect(panel.getByRole("list")).toContainText("第 2 次");
  state.ready = true;
  await expect(page.getByRole("tab", { selected: true })).toHaveText(
    "slow.example",
  );
  await expect(
    page.getByRole("button", { name: "后退", exact: true }),
  ).toBeEnabled();
  expect(await content.evaluate((n) => n.scrollTop)).toBe(0);
  await expect(panel).toHaveCount(0);
  expect(state.retries).toBe(1);
  await page.getByRole("button", { name: "后退", exact: true }).click();
  await expect(page.getByRole("tab", { selected: true })).toHaveText(
    "old.example",
  );
  expect(state.navigations).toEqual(["old.example", "slow.example"]);
});

test("pending navigation restores over the old page, cancel and replacement stay isolated", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/");
  await navigate(page, "old.example");
  await expect(
    page.getByTestId("content-viewport").locator("[data-page-layout]"),
  ).toBeVisible();
  await navigate(page, "slow.example");
  await expect(
    page
      .getByTestId("navigation-progress")
      .getByRole("heading", { name: "正在加载页面" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("navigation-progress")).toBeVisible();
  await expect(
    page.getByTestId("content-viewport").locator("[data-page-layout]"),
  ).toBeVisible();
  expect(state.navigations).toEqual(["old.example", "slow.example"]);
  await page.getByRole("button", { name: "取消本次打开" }).click();
  await expect(page.getByRole("textbox", { name: "网址或搜索词" })).toHaveValue(
    "https://old.example/",
  );
  await expect(page.getByTestId("navigation-progress")).toHaveCount(0);
  await navigate(page, "slow-again.example");
  await navigate(page, "latest.example");
  await expect(page.getByRole("tab", { selected: true })).toHaveText(
    "latest.example",
  );
  state.ready = true;
  await page.waitForTimeout(800);
  await expect(page.getByRole("tab", { selected: true })).toHaveText(
    "latest.example",
  );
});

test("home uses fullscreen progress and both toolbars remain equal on desktop and mobile", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  await navigate(page, "slow.example");
  await expect(page.getByTestId("fullscreen-progress")).toBeVisible();
  await expect(page.getByTestId("navigation-progress")).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const a = (await page
      .getByTestId("browser-brand")
      .locator("..")
      .boundingBox())!;
    const b = (await page.getByTestId("navigation-toolbar").boundingBox())!;
    expect(a.height).toBe(48);
    expect(b.height).toBe(48);
    expect(a.x).toBe(b.x);
    expect(a.width).toBe(b.width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "书签", exact: true }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: "../docs/screenshots/bookmarks-progress/mobile-loading.png",
  });
});

test("progress scroll geometry stays stable through spinner frames and long retry history", async ({
  page,
}) => {
  const state = await setup(page);
  state.extraSteps = [
    "queued",
    "preparing",
    "generating",
    "validating",
    "repairing",
    "retrying",
    "generating",
    "validating",
    "saving",
  ];
  await page.goto("/");
  await navigate(page, "old.example");
  await expect(page.locator("[data-page-layout]")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 400 });
  await navigate(page, "slow.example/" + "long-path-".repeat(70));
  const panel = page.getByTestId("navigation-progress");
  await expect(panel).toBeVisible();
  await page.waitForTimeout(250);
  const sizes = await panel.evaluate(async (node) => {
    const body = node.querySelector(".progress-body")!;
    const samples: string[] = [];
    for (let i = 0; i < 90; i++) {
      await new Promise(requestAnimationFrame);
      samples.push(
        JSON.stringify([
          node.clientWidth,
          node.scrollWidth,
          body.clientHeight,
          body.scrollHeight,
          body.clientWidth,
          body.scrollWidth,
        ]),
      );
    }
    return samples;
  });
  expect(new Set(sizes).size).toBe(1);
  const [width, scrollWidth, height, scrollHeight, bodyWidth, bodyScrollWidth] =
    JSON.parse(sizes[0]);
  expect(scrollWidth).toBe(width);
  expect(bodyScrollWidth).toBe(bodyWidth);
  expect(scrollHeight).toBeGreaterThan(height);
  await panel.getByRole("button", { name: "折叠加载进度" }).click();
  await expect(panel.locator(".progress-body")).toHaveCount(0);
  await panel.getByRole("button", { name: "展开加载进度" }).click();
  await panel.getByRole("button", { name: "取消本次打开" }).click();
  await expect(panel).toHaveCount(0);
  await navigate(page, "cached.example");
  await expect(page.getByRole("tab", { selected: true })).toHaveText(
    "cached.example",
  );
  await expect(panel).toHaveCount(0);
});

test("link previews resolve the click target, handle nested icons/focus and clear on navigation", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/");
  const home = page.getByRole("button", { name: /田野观察季刊/ });
  await home.locator("svg").first().hover();
  await expect(page.getByTestId("link-preview")).toHaveText(
    "https://fieldnotes-journal.example/",
  );
  await navigate(page, "old.example");
  const link = page.getByRole("button", { name: "本期", exact: true });
  await link.focus();
  await expect(page.getByTestId("link-preview")).toHaveText(
    "https://old.example/issue",
  );
  await link.click();
  await expect
    .poll(() => state.navigations.at(-1))
    .toBe("https://old.example/issue");
  await expect(page.getByTestId("link-preview")).toHaveCount(0);
  await page.getByRole("button", { name: "新建标签页", exact: true }).click();
  await expect(page.getByTestId("link-preview")).toHaveCount(0);
});
