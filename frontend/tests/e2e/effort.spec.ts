import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const selected of ["standard", "deep"] as const) {
  test(`${selected} waiting budget follows submitted effort after the selector changes`, async ({
    page,
  }) => {
    const start = new Date("2026-11-08T00:00:00Z");
    await page.clock.setFixedTime(start);
    let polls = 0;
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
    await page.route("**/api/listbookmarks", (r) =>
      r.fulfill({ json: { bookmarks: [] } }),
    );
    await page.route("**/api/navigate", (r) => {
      expect(r.request().postDataJSON().effort).toBe(selected);
      return r.fulfill({
        json: { pageId: "slow", jobId: "slow", status: "generating" },
      });
    });
    await page.route("**/api/getpage", (r) => {
      polls++;
      return r.fulfill({
        json: {
          page: {
            id: "slow",
            address: "https://slow.example/",
            kind: "website",
            prompt: "slow.example",
            status: "generating",
            spec: null,
            currentJobId: "slow",
            referrerId: null,
            error: null,
            source: "mock",
            mode: "imagination",
            effort: selected,
          },
          job: null,
        },
      });
    });
    await page.goto("/");
    const effort = page.getByRole("combobox", { name: "思考强度" });
    await effort.selectOption(selected);
    await page
      .getByRole("textbox", { name: "网址或搜索词" })
      .fill("slow.example");
    await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
    await expect.poll(() => polls).toBeGreaterThan(0);
    await effort.selectOption(selected === "deep" ? "standard" : "deep");
    const before = polls;
    await page.clock.setFixedTime(new Date(start.getTime() + 31 * 60000));
    const timeout = page.getByText("等待时间较长，请重试查看任务状态");
    if (selected === "standard") {
      await expect(timeout).toBeVisible();
    } else {
      await expect.poll(() => polls).toBeGreaterThan(before + 1);
      await expect(timeout).not.toBeVisible();
      await page.clock.setFixedTime(new Date(start.getTime() + 91 * 60000));
      await expect(timeout).toBeVisible();
    }
  });
}

test("effort is snapshotted per navigation, inherited by tabs, restored by history and session", async ({
  page,
}) => {
  const fixture = JSON.parse(
    await readFile("../contracts/fixtures/valid/magazine.json", "utf8"),
  );
  const requests: { input: string; effort: string }[] = [];
  await page.route("**/api/getsettings", (r) =>
    r.fulfill({
      json: {
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-flash",
        hasKey: true,
        revision: 1,
      },
    }),
  );
  await page.route("**/api/listbookmarks", (r) =>
    r.fulfill({ json: { bookmarks: [] } }),
  );
  await page.route("**/api/navigate", async (r) => {
    const request = r.request().postDataJSON();
    requests.push(request);
    await r.fulfill({
      json: {
        pageId: request.input,
        jobId: request.input,
        status: "generating",
      },
    });
  });
  await page.route("**/api/getpage", async (r) => {
    const id = r.request().postDataJSON().pageId;
    const request = requests.find((q) => q.input === id)!;
    if (id === "deep.example")
      await new Promise((resolve) => setTimeout(resolve, 500));
    await r.fulfill({
      json: {
        page: {
          id,
          address: "https://" + id + "/",
          kind: "website",
          prompt: id,
          status: "ready",
          spec: fixture,
          currentJobId: id,
          referrerId: null,
          error: null,
          source: "mock",
          mode: "imagination",
          effort: request.effort,
        },
        job: null,
      },
    });
  });
  await page.goto("/");
  const effort = page.getByRole("combobox", { name: "思考强度" });
  await expect(effort).toHaveValue("standard");
  await expect(effort.locator('option[value="deep"]')).toBeEnabled();
  await effort.selectOption("deep");
  const address = page.getByRole("textbox", { name: "网址或搜索词" });
  await address.fill("deep.example");
  await address.press("Enter");
  await expect.poll(() => requests.length).toBe(1);
  await effort.selectOption("standard");
  await expect(address).toHaveValue("https://deep.example/");
  expect(requests[0].effort).toBe("deep");
  await expect(effort).toHaveValue("standard");
  await address.fill("standard.example");
  await address.press("Enter");
  await expect(address).toHaveValue("https://standard.example/");
  await page.getByRole("button", { name: "后退", exact: true }).click();
  await expect(effort).toHaveValue("deep");
  expect(requests).toHaveLength(2);
  await page.reload();
  await expect(effort).toHaveValue("deep");
  await expect(address).toHaveValue("https://deep.example/");
  expect(requests).toHaveLength(2);
  await page.getByRole("button", { name: "新建标签页", exact: true }).click();
  await expect(effort).toHaveValue("deep");
  await effort.selectOption("standard");
  await page.getByRole("tab").first().click();
  await expect(effort).toHaveValue("deep");
  await page.setViewportSize({ width: 390, height: 600 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("custom interfaces show deep as unavailable", async ({ page }) => {
  await page.route("**/api/getsettings", (r) =>
    r.fulfill({
      json: {
        baseUrl: "https://custom.example",
        model: "model",
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
  ).toBeDisabled();
});
