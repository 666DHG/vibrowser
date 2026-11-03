import { test, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { responseSchema } from "../../src/shared/pageSpec";

test("Chinese domain intent and cross-site search survive URL normalization", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.VIBROWSER_LIVE_SMOKE !== "true",
    "Explicit live opt-in",
  );
  expect((await (await request.get("/health")).json()).mock).toBe(false);
  const file = "../docs/acceptance/address-intent-2026-11-03.json";
  const previous = await readFile(file, "utf8")
    .then(JSON.parse)
    .catch(() => []);
  const run = {
    at: new Date().toISOString(),
    results: [] as Record<string, unknown>[],
  };
  const save = () =>
    writeFile(file, JSON.stringify([...previous, run], null, 2));
  await mkdir("../docs/screenshots/address-intent", { recursive: true });
  await page.goto("/");
  const cases = [
    {
      input: "清华树洞.com/?view=latest",
      name: "campus",
      expected: /清华|树洞|校园/,
    },
    {
      input: "一二三四五上山打老虎.com/?view=latest",
      name: "rhyme",
      expected: /童谣|儿歌/,
    },
    {
      input: "jt8-3合集.com/?view=latest&intent=3",
      name: "game",
      expected: /明日方舟|塔露拉/,
    },
    { input: "一二三四五上山打老虎", name: "search", expected: /童谣|儿歌/ },
  ];
  for (const item of cases) {
    const start = Date.now();
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/api/navigate"),
    );
    const input = page.getByRole("textbox", { name: "网址或搜索词" });
    await input.fill(item.input);
    await input.press("Enter");
    let nav = await (await response).json();
    const cacheHit = nav.status === "ready";
    const retryExistingFailure = nav.status === "failed";
    if (retryExistingFailure) {
      const retry = page.waitForResponse((r) =>
        r.url().endsWith("/api/retrypage"),
      );
      await page.getByRole("button", { name: "重新尝试", exact: true }).click();
      nav = await (await retry).json();
    }
    let raw;
    const deadline = Date.now() + 145000;
    do {
      raw = await (
        await request.post("/api/getpage", {
          data: { pageId: nav.pageId, jobId: null },
        })
      ).json();
      if (raw.page?.status !== "generating") break;
      await page.waitForTimeout(700);
    } while (Date.now() < deadline);
    run.results.push({
      input: item.input,
      cacheHit,
      retryExistingFailure,
      elapsedMs: Date.now() - start,
      pageId: raw.page?.id,
      jobId: raw.page?.currentJobId,
      address: raw.page?.address,
      storedInput: raw.page?.prompt,
      title: raw.page?.spec?.title,
      description: raw.page?.spec?.description,
      design: raw.page?.spec?.design,
      semanticMatch: item.expected.test(JSON.stringify(raw.page?.spec)),
      status: raw.page?.status,
      error: raw.page?.error,
      stages: raw.job?.steps,
    });
    await save();
    const record = responseSchema.parse(raw).page!;
    expect(record.status, record.error ?? item.input).toBe("ready");
    expect(record.source).toBe("live");
    expect(record.prompt).toBe(item.input);
    expect.soft(JSON.stringify(record.spec)).toMatch(item.expected);
    await expect(page.getByRole("tab", { selected: true })).toHaveText(
      record.spec!.title,
      { timeout: 10000 },
    );
    await expect(page.getByTestId("navigation-progress")).toHaveCount(0);
    await page.screenshot({
      path: `../docs/screenshots/address-intent/${item.name}.png`,
    });
  }
});
