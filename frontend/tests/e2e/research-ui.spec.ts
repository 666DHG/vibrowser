import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("missing search configuration reopens the existing settings tab at search controls", async ({
  page,
}) => {
  await page.route("**/api/navigate", (r) =>
    r.fulfill({
      json: { pageId: "missing", jobId: "missing-job", status: "failed" },
    }),
  );
  await page.route("**/api/getpage", (r) =>
    r.fulfill({
      json: {
        page: {
          id: "missing",
          address: "https://missing.example/",
          kind: "website",
          prompt: "missing.example",
          status: "failed",
          spec: null,
          currentJobId: "missing-job",
          referrerId: null,
          error: "请先配置联网搜索",
          source: "mock",
          mode: "research",
        },
        job: null,
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "项目说明", exact: true }).click();
  await page.getByRole("tab").first().click();
  await page
    .getByRole("combobox", { name: "浏览模式" })
    .selectOption("research");
  await page
    .getByRole("textbox", { name: "网址或搜索词" })
    .fill("missing.example");
  await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
  await page.getByRole("button", { name: "配置联网搜索", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "设置", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "联网检索", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("heading", { name: "页面生成", exact: true }),
  ).toBeAttached();
});

test("candidate choice keeps submitted mode after the tab mode changes", async ({
  page,
}) => {
  const document = JSON.parse(
    await readFile("../contracts/web-documents/docs.json", "utf8"),
  );
  let chosen = false,
    submissions = 0;
  await page.route("**/api/navigate", (r) => {
    expect(r.request().postDataJSON().mode).toBe("research");
    submissions++;
    return r.fulfill({
      json: { pageId: "choice", jobId: "choice-job", status: "generating" },
    });
  });
  await page.route("**/api/getpage", (r) =>
    r.fulfill({
      json: {
        page: {
          id: "choice",
          address: "https://people.example/",
          kind: "website",
          prompt: "人物",
          status: chosen ? "ready" : "generating",
          spec: null,
          document: chosen ? document : null,
          currentJobId: "choice-job",
          referrerId: null,
          error: null,
          source: "mock",
          mode: "research",
          sourceCount: 0,
        },
        job: {
          id: "choice-job",
          pageId: "choice",
          kind: "page",
          status: chosen ? "succeeded" : "waiting",
          phase: chosen ? "ready" : "choosing",
          error: null,
          settingsRevision: 1,
          steps: [],
        },
        research: {
          sourceCount: 0,
          selectedCandidateId: chosen ? "a" : null,
          candidates: chosen
            ? []
            : [
                {
                  id: "a",
                  title: "清华大学的研究者",
                  description: "交叉信息研究院",
                  sourceIds: ["source-1"],
                },
                {
                  id: "b",
                  title: "另一位同名研究者",
                  description: "另一所大学",
                  sourceIds: ["source-2"],
                },
              ],
        },
      },
    }),
  );
  await page.route("**/api/selectresearchsubject", (r) => {
    expect(r.request().postDataJSON()).toEqual({
      pageId: "choice",
      candidateId: "a",
    });
    chosen = true;
    return r.fulfill({
      json: { pageId: "choice", jobId: "choice-job", status: "generating" },
    });
  });
  await page.goto("/");
  const mode = page.getByRole("combobox", { name: "浏览模式" });
  await mode.selectOption("research");
  await page.getByRole("textbox", { name: "网址或搜索词" }).fill("人物");
  await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
  await expect(
    page.getByRole("button", { name: /清华大学的研究者/ }),
  ).toBeVisible();
  await mode.selectOption("imagination");
  await page.getByRole("button", { name: /清华大学的研究者/ }).click();
  await expect(page.frameLocator("iframe").locator("h1")).toBeVisible();
  await expect(mode).toHaveValue("imagination");
  expect(submissions).toBe(1);
  const historyMode = await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem("vibrowser.tabs.v2")!);
    return s.tabs[0].entries[0].browsingMode;
  });
  expect(historyMode).toBe("research");
});

test("independent search key drafts stay in the settings tab and are discarded on close", async ({
  page,
}) => {
  const config = {
    reuseGenerationKey: false,
    hasKey: false,
    canReuseGenerationKey: false,
    revision: 1,
  };
  await page.route("**/api/getresearchsettings", (r) =>
    r.fulfill({ json: config }),
  );
  await page.route("**/api/saveresearchsettings", (r) => {
    expect(r.request().postDataJSON()).toEqual({
      reuseGenerationKey: false,
      apiKey: "test-search-key",
    });
    config.hasKey = true;
    return r.fulfill({ json: config });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const key = page.getByRole("textbox", { name: "检索 API Key", exact: true });
  await expect(key).toBeEnabled();
  await key.fill("test-search-key");
  await page.getByRole("button", { name: "项目说明", exact: true }).click();
  await page.getByRole("button", { name: "API 配置", exact: true }).click();
  await expect(key).toHaveValue("test-search-key");
  expect(
    await page.evaluate(() => JSON.stringify([sessionStorage, localStorage])),
  ).not.toContain("test-search-key");
  await page.getByRole("button", { name: "保存检索设置", exact: true }).click();
  await expect(key).toHaveValue("");
  await key.fill("discard-this-draft");
  await page
    .getByRole("button", { name: "关闭标签页：设置", exact: true })
    .click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(key).toHaveValue("");
  expect(
    await page.evaluate(() => JSON.stringify([sessionStorage, localStorage])),
  ).not.toContain("discard-this-draft");
});
