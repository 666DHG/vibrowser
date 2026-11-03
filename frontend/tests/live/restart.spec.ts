import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { responseSchema, settingsSchema } from "../../src/shared/pageSpec";
import { SESSION_KEY } from "../../src/pages/BrowserPage/functions/browserSession";

const evidencePath = "../.data/live-smoke-evidence.json";
test.beforeEach(async ({ request }) => {
  test.skip(
    process.env.VIBROWSER_LIVE_SMOKE !== "true",
    "Explicit live acceptance opt-in required",
  );
  expect((await (await request.get("/health")).json()).mock).toBe(false);
});
test("prepare persistent browser history before restart", async ({ page }) => {
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  const last = evidence.pages.at(-1);
  await page.goto("/");
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/navigate"),
  );
  await page.getByRole("textbox", { name: "网址或搜索词" }).fill(last.address);
  await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
  const nav = await (await response).json();
  expect(nav.status).toBe("ready");
  expect(nav.jobId).toBe(last.jobId);
  await expect(
    page.getByTestId("content-viewport").locator(":scope > article"),
  ).toBeVisible();
  await page
    .context()
    .storageState({ path: "../.data/live-smoke-browser.json" });
  const session = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    SESSION_KEY,
  );
  expect(session).not.toBeNull();
  await writeFile("../.data/live-smoke-session.json", session!, "utf8");
  evidence.restartPreparedAt = new Date().toISOString();
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
});
test.describe("restore", () => {
  test.use({ storageState: "../.data/live-smoke-browser.json" });
  test("restore settings, all cached pages and browser history after restart", async ({
    page,
    request,
  }) => {
    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    const settings = settingsSchema.parse(
      await (await request.post("/api/getsettings", { data: {} })).json(),
    );
    expect(settings).toEqual(evidence.settings);
    for (const entry of evidence.pages) {
      const record = responseSchema.parse(
        await (
          await request.post("/api/getpage", {
            data: { pageId: entry.pageId, jobId: null },
          })
        ).json(),
      ).page!;
      expect(record.status).toBe("ready");
      expect(record.source).toBe("live");
      expect(record.currentJobId).toBe(entry.jobId);
      expect(
        createHash("sha256").update(JSON.stringify(record.spec)).digest("hex"),
      ).toBe(entry.sha256);
    }
    let generationRequests = 0;
    page.on("request", (r) => {
      if (/\/api\/(navigate|retrypage)$/.test(r.url())) generationRequests++;
    });
    // Playwright storageState excludes sessionStorage; restore the same window explicitly.
    await page.addInitScript(
      ({ key, value }) => {
        if (window.location.origin === "http://127.0.0.1:5173")
          sessionStorage.setItem(key, value);
      },
      {
        key: SESSION_KEY,
        value: await readFile("../.data/live-smoke-session.json", "utf8"),
      },
    );
    await page.goto("/");
    await expect(
      page.getByTestId("content-viewport").locator(":scope > article"),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "网址或搜索词" }),
    ).toHaveValue(evidence.pages.at(-1).address);
    expect(generationRequests).toBe(0);
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await expect(page.getByText("已配置 · 留空保留")).toBeVisible();
    await page.getByRole("button", { name: "关闭设置", exact: true }).click();
    await page.screenshot({ path: "../docs/screenshots/live/restarted.png" });
    evidence.restart = {
      verifiedAt: new Date().toISOString(),
      preservedPageCount: evidence.pages.length,
      settingsUnchanged: true,
      historyRestored: true,
      generationRequests,
    };
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  });
});
