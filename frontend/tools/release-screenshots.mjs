import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve("../.cache/playwright");
const { chromium } = await import("@playwright/test");
const origin = `http://127.0.0.1:${process.env.VIBROWSER_UI_PORT ?? 5175}`;
const browser = await chromium.launch({ channel: "chromium" });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const health = await (await context.request.get(origin + "/health")).json();
  if (!health.mock)
    throw new Error("Release screenshots require isolated Mock backend");
  const settings = await (
    await context.request.post(origin + "/api/getsettings", { data: {} })
  ).json();
  if (settings.hasKey)
    throw new Error("Release screenshots require a credential-free schema");
  const page = await context.newPage();
  await mkdir("../docs/public", { recursive: true });
  await page.goto(origin);
  await page.getByTestId("planet-characters").waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../docs/public/home.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "../docs/public/mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("heading", { name: "页面生成", exact: true }).waitFor();
  await page.screenshot({ path: "../docs/public/settings.png" });
  await page.getByRole("button", { name: "首页", exact: true }).click();
  await page.route("**/api/navigate", (route) =>
    route.fulfill({
      json: {
        pageId: "release-example",
        jobId: "release-job",
        status: "generating",
      },
    }),
  );
  await page.route("**/api/getpage", (route) =>
    route.fulfill({
      json: {
        page: {
          id: "release-example",
          address: "https://moon-coffee.example/",
          kind: "website",
          prompt: "moon-coffee.example",
          status: "generating",
          spec: null,
          currentJobId: "release-job",
          referrerId: null,
          error: null,
          source: "mock",
        },
        job: {
          id: "release-job",
          pageId: "release-example",
          kind: "page",
          status: "running",
          phase: "generating",
          error: null,
          settingsRevision: 1,
          steps: [
            { phase: "generating", attempt: 1, at: new Date().toISOString() },
          ],
        },
      },
    }),
  );
  await page
    .getByRole("textbox", { name: "网址或搜索词" })
    .fill("moon-coffee.example");
  await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
  await page.getByTestId("companion-cat").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "../docs/public/progress.png" });
} finally {
  await browser.close();
}
