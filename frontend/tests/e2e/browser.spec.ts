import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test.beforeAll(async ({ request }) => {
  const health = await (await request.get("/health")).json();
  if (!health.mock)
    throw new Error(
      "E2E requires explicit VIBROWSER_MOCK=true; real provider is never used by this suite",
    );
});
test("home, website, link, history, refresh and fictional search", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /世界还没写好/ }),
  ).toBeVisible();
  await mkdir("../docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "../docs/screenshots/home.png",
    fullPage: true,
  });
  const address = page.getByRole("textbox", { name: "网址或搜索词" });
  await address.fill("smoke-" + Date.now() + ".example");
  await address.press("Enter");
  await expect(
    page.getByRole("heading", { name: "离地球很远， 离一杯好咖啡很近。" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/generated-page.png",
    fullPage: true,
  });
  const original = await address.inputValue();
  await page.getByRole("button", { name: "查看完整菜单" }).click();
  await expect(address).toHaveValue(original + "menu");
  await expect(page.getByRole("heading", { name: /离地球很远/ })).toBeVisible();
  await page.getByRole("button", { name: "后退", exact: true }).click();
  await expect(address).toHaveValue(original);
  await page.getByRole("button", { name: "前进", exact: true }).click();
  await expect(address).toHaveValue(original + "menu");
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect(page.getByRole("heading", { name: /离地球很远/ })).toBeVisible();
  await address.fill("月球旅行");
  await address.press("Enter");
  await expect(
    page.getByRole("heading", { name: "月球旅行", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("虚构搜索结果 · 内容由 AI 生成，并非真实互联网搜索"),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/search.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Moon Coffee · 静海咖啡馆" }).click();
  await expect(address).toHaveValue("https://moon-coffee.example/");
  await expect(page.getByRole("heading", { name: /离地球很远/ })).toBeVisible();
  expect(errors).toEqual([]);
});
test("settings save, mask, test, reload and clear fake credential", async ({
  page,
  request,
}) => {
  const previous = await (
    await request.post("/api/getsettings", { data: {} })
  ).json();
  test.skip(previous.hasKey, "Never overwrite a pre-existing user credential");
  await page.goto("/");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "连接你的想象引擎" }),
  ).toBeVisible();
  try {
    await page
      .getByRole("textbox", { name: "API Key" })
      .fill("smoke-fake-key-ui-only");
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByText("设置已保存到本机")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "API Key" })).toHaveValue(
      "",
    );
    const safe = await (
      await request.post("/api/getsettings", { data: {} })
    ).text();
    expect(safe).not.toContain("smoke-fake-key-ui-only");
    await page.getByRole("button", { name: "测试连接" }).click();
    await expect(page.getByText("连接成功，模型已返回响应")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await expect(page.getByText("已配置 · 留空保留")).toBeVisible();
    await page.screenshot({
      path: "../docs/screenshots/settings.png",
      fullPage: true,
    });
    await page
      .getByRole("textbox", { name: "Base URL" })
      .fill("https://another.example/v1");
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByRole("alert")).toContainText("重新填写密钥");
    await page.getByRole("button", { name: "清除密钥" }).click();
    await expect(page.getByText("密钥已清除")).toBeVisible();
  } finally {
    await request.post("/api/clearcredentials", { data: {} });
    await request.post("/api/savesettings", {
      data: { baseUrl: previous.baseUrl, model: previous.model, apiKey: null },
    });
  }
});
test("invalid protocol and rapid navigation never replace newer content", async ({
  page,
}) => {
  await page.goto("/");
  const address = page.getByRole("textbox", { name: "网址或搜索词" });
  await address.fill("javascript:alert(1)");
  await address.press("Enter");
  await expect(page.getByRole("alert")).toContainText("网址无效");
  await page.route("**/api/navigate", async (route) => {
    const payload = route.request().postDataJSON();
    if (payload.input === "slow.example") {
      await new Promise((r) => setTimeout(r, 1200));
      await route.abort();
      return;
    }
    await route.continue();
  });
  await address.fill("slow.example");
  await address.press("Enter");
  await address.fill("月球旅行");
  await address.press("Enter");
  await expect(
    page.getByRole("heading", { name: "月球旅行", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1400);
  await expect(address).toHaveValue("月球旅行");
  await expect(
    page.getByRole("heading", { name: "月球旅行", exact: true }),
  ).toBeVisible();
});
test("mobile layout stays within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "网址或搜索词" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/screenshots/mobile.png",
    fullPage: true,
  });
});
