import { test, expect } from "@playwright/test";
test("mode choice is tab scoped and settings is a persistent internal tab", async ({
  page,
}) => {
  await page.goto("/");
  const mode = page.getByRole("combobox", { name: "浏览模式" });
  await expect(mode).toHaveValue("imagination");
  await mode.selectOption("research");
  await page.getByRole("button", { name: "新建标签页", exact: true }).click();
  await expect(mode).toHaveValue("research");
  await mode.selectOption("imagination");
  await page.getByRole("tab").first().click();
  await expect(mode).toHaveValue("research");
  let generated = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/navigate")) generated++;
  });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "设置导航" }),
  ).toBeVisible();
  const base = page.getByRole("textbox", { name: "Base URL", exact: true });
  await expect(base).toBeEnabled();
  await base.fill("https://draft.example");
  await page.getByRole("button", { name: "项目说明", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Vibrowser", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "API 配置", exact: true }).click();
  await expect(base).toHaveValue("https://draft.example");
  await page.getByRole("tab").first().click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "设置", exact: true }),
  ).toHaveCount(1);
  await expect(base).toHaveValue("https://draft.example");
  expect(generated).toBe(0);
  await page.setViewportSize({ width: 390, height: 600 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
