import { test, expect } from "@playwright/test";
import { setup, navigate } from "./companionFixtures";
import { mkdir } from "node:fs/promises";
test("one persistent cat, local click cooldown, reduced motion and settings across windows", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("companion-cat")).toHaveCount(1);
  await page.getByTestId("companion-cat").click();
  await expect(
    page.getByRole("button", { name: "关闭小猫气泡" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭小猫气泡" }).click();
  await page.getByTestId("companion-cat").click();
  await expect(page.getByRole("button", { name: "关闭小猫气泡" })).toHaveCount(
    0,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".cat-sprite")
      .evaluate((n) => getComputedStyle(n).animationName),
  ).toBe("none");
  const second = await context.newPage();
  await second.goto("/");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "小猫陪伴", exact: true }).click();
  await page.getByLabel("显示小猫", { exact: true }).uncheck();
  await expect(page.getByTestId("companion-cat")).toHaveCount(0);
  await expect(second.getByTestId("companion-cat")).toHaveCount(0);
  await page.getByLabel("显示小猫", { exact: true }).check();
  await expect(second.getByTestId("companion-cat")).toHaveCount(1);
});
test("compact progress owns the bubble, changes tabs safely, hidden cat retains actions", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/");
  await page.getByTestId("companion-cat").click();
  await navigate(page, "slow.cat.example");
  const panel = page.getByTestId("navigation-progress");
  await expect(panel).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭小猫气泡" })).toHaveCount(
    0,
  );
  await expect(panel.getByRole("list")).toHaveCount(0);
  await page.getByTestId("companion-cat").click();
  await expect(panel.getByRole("list")).toBeVisible();
  await mkdir("../.data/release-archive/docs/screenshots/companion", {
    recursive: true,
  });
  await page.screenshot({
    animations: "disabled",
    path: "../.data/release-archive/docs/screenshots/companion/desktop.png",
  });
  await page.getByRole("button", { name: "新建标签页", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId("companion-cat")).toHaveCount(1);
  await page.getByRole("tab").first().click();
  await expect(panel).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem(
      "vibrowser.companion.v1",
      JSON.stringify({ visible: false, automatic: false, ai: false }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: "vibrowser.companion.v1" }),
    );
  });
  await expect(page.getByTestId("companion-cat")).toHaveCount(0);
  state.failed = true;
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "重新尝试", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "取消本次打开" }).click();
  await expect(panel).toHaveCount(0);
});
test("stale AI does not replace progress", async ({ page }) => {
  await setup(page);
  await page.route("**/api/getsettings", (r) =>
    r.fulfill({
      json: {
        baseUrl: "https://api.deepseek.com",
        model: "test",
        revision: 1,
        hasKey: true,
      },
    }),
  );
  let requests = 0;
  await page.route("**/api/requestcompanionreply", (r) => {
    requests++;
    return r.fulfill({
      json: { id: "cat", status: "queued", text: null, expression: "idle" },
    });
  });
  await page.route("**/api/getcompanionreply", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await r
      .fulfill({
        json: {
          id: "cat",
          status: "complete",
          text: "不该出现的旧回应",
          expression: "happy",
        },
      })
      .catch(() => {});
  });
  await page.goto("/");
  await page.getByTestId("companion-cat").click();
  await expect.poll(() => requests).toBe(1);
  await navigate(page, "slow.stale.example");
  await expect(page.getByTestId("navigation-progress")).toBeVisible();
  await page.waitForTimeout(1700);
  await expect(page.getByText("不该出现的旧回应")).toHaveCount(0);
  await page.getByTestId("companion-cat").click();
  await expect(page.getByRole("list", { name: "加载步骤" })).toBeVisible();
  expect(requests).toBe(1);
});
test("small viewport keeps long errors and task controls reachable", async ({
  page,
}) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 390, height: 400 });
  await page.goto("/");
  await navigate(page, "slow.tiny.example");
  state.failed = true;
  const panel = page.getByTestId("navigation-progress");
  await expect(panel.getByRole("alert")).toBeVisible();
  const box = (await panel.boundingBox())!,
    cat = (await page.getByTestId("companion-cat").boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(96);
  expect(box.y + box.height).toBeLessThanOrEqual(cat.y);
  await page.screenshot({
    animations: "disabled",
    path: "../.data/release-archive/docs/screenshots/companion/mobile-error.png",
  });
  await panel.getByRole("button", { name: "取消本次打开" }).click();
  await expect(panel).toHaveCount(0);
});

test("AI opt-out discards delayed reply and mock API roundtrip works", async ({
  page,
  request,
}) => {
  expect((await (await request.get("/health")).json()).mock).toBe(true);
  const response = await request.post("/api/requestcompanionreply", {
    data: {
      context: {
        event: "click",
        input: "月球咖啡",
        title: "月球",
        mode: "imagination",
      },
    },
  });
  expect(response.ok()).toBe(true);
  const queued = await response.json();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.post("/api/getcompanionreply", {
              data: { id: queued.id },
            })
          ).json()
        ).status,
    )
    .toBe("complete");
  await page.route("**/api/getsettings", (r) =>
    r.fulfill({
      json: {
        baseUrl: "https://api.deepseek.com",
        model: "test",
        revision: 1,
        hasKey: true,
      },
    }),
  );
  let count = 0;
  await page.route("**/api/requestcompanionreply", (r) => {
    count++;
    return r.fulfill({
      json: { id: "late", status: "queued", text: null, expression: "idle" },
    });
  });
  await page.route("**/api/getcompanionreply", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await r
      .fulfill({
        json: {
          id: "late",
          status: "complete",
          text: "关闭后不能显示",
          expression: "happy",
        },
      })
      .catch(() => {});
  });
  await page.goto("/");
  await page.getByTestId("companion-cat").click();
  await expect.poll(() => count).toBe(1);
  await page.evaluate(() => {
    localStorage.setItem(
      "vibrowser.companion.v1",
      JSON.stringify({ visible: true, automatic: true, ai: false }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: "vibrowser.companion.v1" }),
    );
  });
  await page.waitForTimeout(1500);
  await expect(page.getByText("关闭后不能显示")).toHaveCount(0);
});

test("larger cat drags without clicking and stays reachable after resize", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  const cat = page.getByTestId("companion-cat");
  const before = (await cat.boundingBox())!;
  expect(before.width).toBe(104);
  await page.mouse.move(before.x + 50, before.y + 50);
  await page.mouse.down();
  await page.mouse.move(before.x - 250, before.y - 150, { steps: 8 });
  await page.mouse.up();
  const after = (await cat.boundingBox())!;
  expect(after.x).toBeLessThan(before.x - 200);
  expect(after.y).toBeLessThan(before.y - 100);
  await expect(page.getByRole("button", { name: "关闭小猫气泡" })).toHaveCount(
    0,
  );
  await cat.click();
  await expect(
    page.getByRole("button", { name: "关闭小猫气泡" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 600 });
  await expect.poll(async () => (await cat.boundingBox())!.width).toBe(72);
  const dock = page.getByTestId("companion-dock");
  await expect
    .poll(async () => {
      const box = (await dock.boundingBox())!;
      return (
        box.x >= 0 &&
        box.y >= 100 &&
        box.x + box.width <= 390 &&
        box.y + box.height <= 600
      );
    })
    .toBe(true);
});
