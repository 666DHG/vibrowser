import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  responseSchema,
  settingsSchema,
  type PageBlock,
  type PageRecord,
} from "../../src/shared/pageSpec";

test("live DeepSeek connection, repaired pages, search, links and cache", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.VIBROWSER_LIVE_SMOKE !== "true",
    "Explicit opt-in required: this test makes billable calls",
  );
  const health = await (await request.get("/health")).json();
  expect(health.mock).toBe(false);
  const settings = settingsSchema.parse(
    await (await request.post("/api/getsettings", { data: {} })).json(),
  );
  expect(settings.hasKey).toBe(true);
  const evidence: Record<string, unknown> = {
    date: new Date().toISOString(),
    settings,
    pages: [],
    checks: [],
  };
  await mkdir("../docs/screenshots/live", { recursive: true });
  const save = () =>
    writeFile(
      "../.data/live-smoke-evidence.json",
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const digest = (record: PageRecord) =>
    createHash("sha256").update(JSON.stringify(record.spec)).digest("hex");
  const read = async (id: string) =>
    responseSchema.parse(
      await (
        await request.post("/api/getpage", {
          data: { pageId: id, jobId: null },
        })
      ).json(),
    ).page!;
  const waitReady = async (id: string) => {
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      const record = await read(id);
      if (record.status === "failed")
        throw new Error(record.address + ": " + record.error);
      if (record.status === "ready") {
        expect(record.source).toBe("live");
        await expect(
          page.getByTestId("content-viewport").locator(":scope > article"),
        ).toBeVisible({ timeout: 5000 });
        return record;
      }
      await page.waitForTimeout(800);
    }
    throw new Error("Live task did not finish within 150 seconds");
  };
  const navigate = async (input: string) => {
    const started = Date.now();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/navigate") && r.request().method() === "POST",
    );
    const address = page.getByRole("textbox", { name: "网址或搜索词" });
    await address.fill(input);
    await address.press("Enter");
    let nav = await (await response).json();
    if (nav.status === "failed") {
      const retry = page.waitForResponse((r) =>
        r.url().endsWith("/api/retrypage"),
      );
      await page.getByRole("button", { name: "重新尝试", exact: true }).click();
      nav = await (await retry).json();
    }
    const record = await waitReady(nav.pageId);
    (evidence.pages as unknown[]).push({
      input,
      pageId: record.id,
      jobId: record.currentJobId,
      address: record.address,
      status: record.status,
      source: record.source,
      elapsedMs: Date.now() - started,
      sha256: digest(record),
    });
    await save();
    return record;
  };
  const flatten = (blocks: PageBlock[]): PageBlock[] =>
    blocks.flatMap((b) => [b, ...flatten(b.items)]);
  await page.goto("/");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByText("已配置 · 留空保留")).toBeVisible();
  const connection = page.waitForResponse((r) =>
    r.url().endsWith("/api/testconnection"),
  );
  await page.getByRole("button", { name: "测试连接", exact: true }).click();
  evidence.connectionJobId = (await (await connection).json()).jobId;
  await expect(page.getByText("连接成功，模型已返回响应")).toBeVisible({
    timeout: 75000,
  });
  await page.screenshot({ path: "../docs/screenshots/live/connection.png" });
  await page.getByRole("button", { name: "关闭设置", exact: true }).click();
  await navigate("moon-coffee.example");
  await page.screenshot({ path: "../docs/screenshots/live/website.png" });
  const search = await navigate("月球旅行");
  expect(search.kind).toBe("search");
  const result = flatten(search.spec!.blocks).find(
    (b) => b.type === "card" && b.target?.startsWith("https://"),
  );
  expect(result).toBeDefined();
  await page.screenshot({ path: "../docs/screenshots/live/search.png" });
  const next = page.waitForResponse((r) => r.url().endsWith("/api/navigate"));
  await page
    .getByTestId("content-viewport")
    .getByRole("button", { name: result!.title!, exact: true })
    .first()
    .click();
  const clicked = await waitReady((await (await next).json()).pageId);
  (evidence.pages as unknown[]).push({
    input: "click search result",
    pageId: clicked.id,
    jobId: clicked.currentJobId,
    address: clicked.address,
    status: clicked.status,
    source: clicked.source,
    sha256: digest(clicked),
  });
  await save();
  await page.screenshot({ path: "../docs/screenshots/live/linked-page.png" });
  let newGenerations = 0;
  page.on("request", (r) => {
    if (/\/api\/(navigate|retrypage)$/.test(r.url())) newGenerations++;
  });
  await page.getByRole("button", { name: "后退", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "网址或搜索词" })).toHaveValue(
    "月球旅行",
  );
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect(
    page.getByTestId("content-viewport").locator(":scope > article"),
  ).toBeVisible();
  const cached = await read(search.id);
  expect(cached.currentJobId).toBe(search.currentJobId);
  expect(digest(cached)).toBe(digest(search));
  await page.getByRole("button", { name: "前进", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "网址或搜索词" })).toHaveValue(
    clicked.address,
  );
  await page.reload();
  await expect(
    page.getByTestId("content-viewport").locator(":scope > article"),
  ).toBeVisible();
  expect(newGenerations).toBe(0);
  evidence.cache = {
    pageId: search.id,
    jobId: cached.currentJobId,
    unchangedHash: digest(cached),
    navigationRequestsDuringHistoryRefreshReload: newGenerations,
  };
  await save();
  for (const input of ["cat.com", "猫窝", "future-botany.example"])
    await navigate(input);
  expect(pageErrors).toEqual([]);
  evidence.status = "passed";
  evidence.pageErrors = pageErrors;
  await save();
});
