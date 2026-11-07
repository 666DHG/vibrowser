import { setup, navigate } from "./companionFixtures";
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

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
  await panel.getByRole("button", { name: "展开加载进度" }).click();
  await expect(panel.getByRole("list", { name: "加载步骤" })).toContainText(
    "准备页面",
  );
  await mkdir("../docs/screenshots/companion", { recursive: true });
  await page.screenshot({
    animations: "disabled",
    path: "../docs/screenshots/companion/loading.png",
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
  await panel.getByRole("button", { name: "展开加载进度" }).click();
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
  await page.getByRole("button", { name: "展开加载进度" }).click();
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

test("home uses cat bubble progress and both toolbars remain equal on desktop and mobile", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  await navigate(page, "slow.example");
  await expect(page.getByTestId("fullscreen-progress")).toHaveCount(0);
  await expect(page.getByTestId("navigation-progress")).toBeVisible();
  await expect(page.getByTestId("companion-cat")).toBeVisible();
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
    animations: "disabled",
    path: "../docs/screenshots/companion/mobile-loading.png",
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
  await panel.getByRole("button", { name: "展开加载进度" }).click();
  await page.waitForTimeout(250);
  const observations: unknown[] = [];
  await mkdir("../docs/screenshots/companion", { recursive: true });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 390, height: 400 },
  ]) {
    await page.setViewportSize(viewport);
    const sizes = await panel.evaluate(async (node) => {
      const body = node.querySelector(".progress-body")!.parentElement!;
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
    const [
      width,
      scrollWidth,
      height,
      scrollHeight,
      bodyWidth,
      bodyScrollWidth,
    ] = JSON.parse(sizes[0]);
    expect(scrollWidth).toBe(width);
    expect(bodyScrollWidth).toBe(bodyWidth);
    if (viewport.height === 400) expect(scrollHeight).toBeGreaterThan(height);
    observations.push({
      viewport,
      frames: sizes.length,
      uniqueSizes: new Set(sizes).size,
      panelWidth: width,
      panelScrollWidth: scrollWidth,
      bodyHeight: height,
      bodyScrollHeight: scrollHeight,
      bodyWidth,
      bodyScrollWidth,
    });
    await page.screenshot({
      animations: "disabled",
      path: `../docs/screenshots/companion/progress-${viewport.width}-${viewport.height}.png`,
    });
  }
  await writeFile(
    "../docs/acceptance/companion-scroll.json",
    JSON.stringify(observations, null, 2),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await panel
      .locator(".animate-spin")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
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

test("design stages keep the previous page visible and render translated progress", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/");
  await navigate(page, "old.example");
  await expect(
    page.getByTestId("content-viewport").locator("[data-page-layout]"),
  ).toBeVisible();
  await navigate(page, "slow.design.example");
  await page.getByRole("button", { name: "展开加载进度" }).click();
  const phases = ["designing", "measuring", "reviewing", "refining"];
  const names = ["设计页面", "检查布局", "评审设计", "优化页面"];
  for (let i = 0; i < phases.length; i++) {
    state.phase = phases[i];
    state.extraSteps = ["queued", ...phases.slice(0, i + 1)];
    await expect(
      page
        .getByTestId("navigation-progress")
        .getByRole("heading", { name: names[i] }),
    ).toBeVisible();
    await expect(
      page.getByTestId("navigation-progress").getByRole("list"),
    ).toContainText(names[i]);
    await expect(
      page.getByTestId("content-viewport").locator("[data-page-layout]"),
    ).toBeVisible();
  }
  state.ready = true;
  await expect(page.getByRole("tab", { selected: true })).toHaveText(
    "slow.design.example",
  );
});
