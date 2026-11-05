import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
for (const name of ["forum", "shop", "docs"])
  test("isolated v3 runtime: " + name, async ({ page }) => {
    const document = JSON.parse(
      await readFile("../contracts/web-documents/" + name + ".json", "utf8"),
    );
    let currentDocument = document;
    let currentId = "sample";
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/health", (r) =>
      r.fulfill({ json: { status: "ok", mock: true } }),
    );
    await page.route("**/api/listbookmarks", (r) =>
      r.fulfill({ json: { bookmarks: [] } }),
    );
    await page.route("**/api/navigate", (r) =>
      r.fulfill({ json: { pageId: "sample", jobId: "job", status: "ready" } }),
    );
    await page.route("**/api/getpage", (r) =>
      r.fulfill({
        json: {
          page: {
            id: currentId,
            address: "https://sample.example/",
            kind: "website",
            prompt: "sample.example",
            status: "ready",
            spec: null,
            document: currentDocument,
            currentJobId: "job",
            referrerId: null,
            error: null,
            source: "mock",
          },
          job: {
            id: "job",
            pageId: "sample",
            kind: "page",
            status: "succeeded",
            phase: "ready",
            error: null,
            settingsRevision: 1,
            steps: [],
          },
        },
      }),
    );
    await page.goto("/");
    await page
      .getByRole("textbox", { name: "网址或搜索词" })
      .fill("sample.example");
    await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
    const frame = page.frameLocator("iframe");
    await expect(frame.locator("h1")).toBeVisible();
    let requests = 0;
    page.on("request", (r) => {
      if (/\/api\/(navigate|submitpageaction|retrypage)$/.test(r.url()))
        requests++;
    });
    if (name === "forum") {
      await frame.locator("#toggle").click();
      await expect(frame.locator("#replies")).toBeVisible();
      await frame.locator("#filter").fill("选课");
      await expect(frame.locator("#posts article:visible")).toHaveCount(1);
    }
    if (name === "shop") {
      await frame.locator("#add").click();
      await expect(frame.locator("output")).toHaveText("1");
      await frame.locator("#spec").selectOption("大号");
      await frame.locator("#remove").click();
      await expect(frame.locator("output")).toHaveText("0");
    }
    if (name === "docs") {
      await frame.locator("#toggle").click();
      await expect(frame.locator("#chapters")).toBeVisible();
    }
    expect(requests).toBe(0);
    if (name === "forum") {
      await frame.locator('input[name="q"]').fill("更新时保留的草稿");
      const input = await frame.locator('input[name="q"]').elementHandle();
      await page.route("**/api/submitpageaction", async (r) => {
        expect(r.request().postDataJSON().actionId).toBe("more");
        currentId = "patched";
        currentDocument = {
          ...document,
          html: document.html.replace(
            "</main>",
            '<article id="new-row">选课追加回复</article></main>',
          ),
        };
        await r.fulfill({
          json: { pageId: currentId, jobId: "job", status: "ready" },
        });
      });
      await frame.locator("#more").click();
      await expect(frame.locator("#new-row")).toBeVisible();
      expect(await input!.evaluate((e) => e.isConnected)).toBe(true);
      await expect(frame.locator('input[name="q"]')).toHaveValue(
        "更新时保留的草稿",
      );
      await page.unroute("**/api/submitpageaction");
    }
    await page.route("**/api/submitpageaction", async (route) => {
      const data = route.request().postDataJSON();
      expect(data.actionId).toBe("search");
      expect(data.values.q).toBe("中文查询");
      expect(data.revision).toBe("job");
      await route.fulfill({
        status: 400,
        json: { message: "测试失败保留旧页" },
      });
    });
    await frame.locator('input[name="q"]').fill("中文查询");
    await frame.locator('input[name="q"]').press("Enter");
    await expect(page.getByText("测试失败保留旧页")).toBeVisible();
    await expect(frame.locator('input[name="q"]')).toHaveValue("中文查询");
    await page.reload();
    await expect(page.locator("iframe")).toBeVisible();
    await expect(frame.locator('input[name="q"]')).toHaveValue("中文查询");
    await page.setViewportSize({ width: 390, height: 400 });
    await expect(page.locator("iframe")).toBeVisible();
    const isolated = await frame.locator("body").evaluate(() => {
      try {
        void parent.document;
        return false;
      } catch {
        return true;
      }
    });
    expect(isolated).toBe(true);
    expect(errors).toEqual([]);
    await expect(page.locator("iframe")).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-forms",
    );
    await page.screenshot({ path: "../.cache/v3-" + name + ".png" });
  });
