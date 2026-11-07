import { test, expect } from "@playwright/test";
import { readFile, readdir, writeFile } from "node:fs/promises";
test("replay real design documents through the browser runtime without model requests", async ({
  browser,
}) => {
  const directory =
    process.env.VIBROWSER_DESIGN_REPLAY_DIR ?? "../.cache/design-acceptance/";
  const findings: object[] = [];
  for (const file of (await readdir(directory)).filter((f) =>
    /-new(?:-standard|-deep)?\.json$/.test(f),
  )) {
    const record = JSON.parse(await readFile(directory + file, "utf8"));
    if (!record.document) continue;
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route("**/api/listbookmarks", (r) =>
      r.fulfill({ json: { bookmarks: [] } }),
    );
    await page.route("**/api/navigate", (r) =>
      r.fulfill({
        json: { pageId: record.pageId, jobId: record.jobId, status: "ready" },
      }),
    );
    await page.route("**/api/getpage", (r) =>
      r.fulfill({
        json: {
          page: {
            id: record.pageId,
            address: "https://replay.example/",
            kind: "website",
            prompt: record.input,
            status: "ready",
            spec: null,
            document: record.document,
            currentJobId: record.jobId,
            referrerId: null,
            error: null,
            source: "live",
            mode: record.mode,
            effort: record.effort ?? "standard",
          },
          job: null,
        },
      }),
    );
    await page.goto("http://127.0.0.1:5173/");

    await page
      .getByRole("textbox", { name: "网址或搜索词" })
      .fill(record.input);
    await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
    const frame = page.frameLocator("iframe");
    await expect(page.locator("iframe")).toHaveAttribute(
      "title",
      record.document.title,
    );
    await expect(frame.locator("h1").first()).toBeVisible();
    let requests = 0;
    const listener = (r: { url(): string }) => {
      if (/\/api\/(navigate|submitpageaction|retrypage)$/.test(r.url()))
        requests++;
    };
    page.on("request", listener);
    const local: string[] = [];
    for (const action of record.document.actions.filter(
      (a: { kind: string }) => a.kind === "Toggle",
    )) {
      const button = frame.locator(`[id=${JSON.stringify(action.elementId)}]`);
      if (!(await button.isVisible())) continue;
      const region = frame.locator(`[id=${JSON.stringify(action.region)}]`);
      const before = await region.isVisible();
      await button.click();
      await expect(region).toBeVisible({ visible: !before });
      await button.click();
      local.push(action.id);
      break;
    }
    expect(requests).toBe(0);
    const copy = record.document.actions.find(
      (a: { kind: string }) => a.kind === "Copy",
    );
    let copyVerified = false;
    if (copy) {
      const button = frame.locator(`[id=${JSON.stringify(copy.elementId)}]`);
      if (await button.isVisible()) {
        const expectedText = await frame
          .locator(`[id=${JSON.stringify(copy.region)}]`)
          .innerText();
        await page.evaluate(() => {
          Object.assign(window, { copiedTexts: [] as string[] });
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
              writeText: async (text: string) => {
                (
                  window as unknown as { copiedTexts: string[] }
                ).copiedTexts.push(text);
              },
            },
          });
        });
        await button.click();
        await expect(
          frame
            .locator(`[data-state=${JSON.stringify(copy.stateKey)}]`)
            .first(),
        ).toHaveText("已复制");
        expect(
          await page.evaluate(
            () => (window as unknown as { copiedTexts: string[] }).copiedTexts,
          ),
        ).toEqual([expectedText]);
        copyVerified = true;
      }
    }
    expect(requests).toBe(0);
    const search = record.document.actions.find(
      (a: { kind: string }) => a.kind === "Search",
    );
    let searchSubmitted = false;
    if (search) {
      await page.route("**/api/submitpageaction", (r) => {
        const data = r.request().postDataJSON();
        expect(data.actionId).toBe(search.id);
        expect(data.values.q).toBe("主题检索");
        searchSubmitted = true;
        return r.fulfill({ status: 400, json: { message: "验收拦截提交" } });
      });
      const form = frame.locator(`[id=${JSON.stringify(search.elementId)}]`);
      if (await form.isVisible()) {
        await form.locator('[name="q"]').fill("主题检索");
        await form.locator('[name="q"]').press("Enter");
        await expect(page.getByText("验收拦截提交")).toBeVisible();
        await expect(form.locator('[name="q"]')).toHaveValue("主题检索");
      }
    }
    findings.push({
      file,
      localActions: local,
      searchSubmitted,
      copyVerified,
      extraModelCalls: 0,
    });
    page.off("request", listener);
    await context.close();
  }
  await writeFile(
    process.env.VIBROWSER_DESIGN_REPLAY_REPORT ??
      "../docs/screenshots/design-workflow/interaction-replay.json",
    JSON.stringify(findings, null, 2),
  );
});
