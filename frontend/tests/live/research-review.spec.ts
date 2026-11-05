import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

test("review saved research pages and responsive settings without generation", async ({
  browser,
  request,
}) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  const evidence = JSON.parse(
    await readFile("../docs/acceptance/research-2026-11-05.json", "utf8"),
  );
  const results: any[] = [];
  for (const label of [
    "person",
    "institution",
    "knowledge",
    "person-site-search",
    "person-detail",
    "imagination-control",
  ]) {
    const row = [...evidence]
      .reverse()
      .find((r: any) => r.label === label && r.status === "ready");
    const { page: record } = await (
      await request.post("/api/getpage", { data: { pageId: row.pageId } })
    ).json();
    const page = await browser.newPage();
    let generated = 0;
    page.on("request", (r) => {
      if (/\/api\/(navigate|submitpageaction|retrypage)$/.test(r.url()))
        generated++;
    });
    await page.addInitScript(
      (r) =>
        sessionStorage.setItem(
          "vibrowser.tabs.v2",
          JSON.stringify({
            activeTabId: "review",
            tabs: [
              {
                id: "review",
                title: r.document.title,
                draft: r.prompt,
                view: "ready",
                browsingMode: r.mode,
                entries: [
                  {
                    pageId: r.id,
                    input: r.prompt,
                    address: r.address,
                    browsingMode: r.mode,
                  },
                ],
                index: 0,
              },
            ],
          }),
        ),
      record,
    );
    await page.goto("/");
    const body = page.frameLocator("iframe").locator("body");
    await expect
      .poll(async () => (await body.innerText()).length)
      .toBeGreaterThan(80);
    await page.waitForTimeout(2100);
    await page.screenshot({
      path: `../docs/screenshots/research/${label}.png`,
    });
    const text = await body.innerText();
    expect(text).not.toMatch(/不保证|仅供参考|只能作为参考/);
    if (label === "person") {
      expect(text).toContain("袁洋");
      expect(text).toContain("清华大学");
      expect(text).toContain("中医");
      await page
        .getByRole("button", {
          name: `来源 ${record.sourceCount}`,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("link", { name: "查看原文" }).first(),
      ).toHaveAttribute(
        "href",
        "https://people.iiis.tsinghua.edu.cn/~yuanyang/index.html",
      );
      const opened = page.waitForEvent("popup");
      await page.getByRole("link", { name: "查看原文" }).first().click();
      const original = await opened;
      await original.waitForLoadState("domcontentloaded");
      await expect(original.locator("body")).toContainText("袁洋");
      await original.close();
      await page.screenshot({
        path: "../docs/screenshots/research/person-sources.png",
      });
      await page.setViewportSize({ width: 390, height: 600 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "../docs/screenshots/research/mobile-sources.png",
      });
    }
    expect(generated).toBe(0);
    results.push({
      label,
      pageId: record.id,
      generated,
      bodyCharacters: text.length,
      naturalCopy: true,
    });
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "测试联网搜索", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: "../docs/screenshots/research/settings.png" });
  await page.getByRole("button", { name: "项目说明", exact: true }).click();
  await page.screenshot({ path: "../docs/screenshots/research/about.png" });
  await page.setViewportSize({ width: 390, height: 600 });
  await page.getByRole("button", { name: "API 配置", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/screenshots/research/mobile-settings.png",
  });
  await page.close();
  await writeFile(
    "../docs/acceptance/research-review-2026-11-05.json",
    JSON.stringify(results, null, 2),
  );
});
