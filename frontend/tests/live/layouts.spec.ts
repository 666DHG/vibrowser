import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { responseSchema, type PageBlock } from "../../src/shared/pageSpec";
test("real websites choose distinct layouts and variable content structures", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.VIBROWSER_LIVE_SMOKE !== "true",
    "Explicit opt-in required for billable calls",
  );
  expect((await (await request.get("/health")).json()).mock).toBe(false);
  const cases = [
    ["fieldnotes-journal.example", "editorial"],
    ["stationery-shop.example", "storefront"],
    ["docs.tidb-lab.example/quickstart", "documentation"],
    ["forum.city-cycling.example", "community"],
  ];
  const evidence: Record<string, unknown>[] = [];
  const flatten = (blocks: PageBlock[]): PageBlock[] =>
    blocks.flatMap((b) => [b, ...flatten(b.items)]);
  await mkdir("../.data/release-archive/docs/screenshots/layouts-live", {
    recursive: true,
  });
  await mkdir("../.data/release-archive/docs/acceptance", { recursive: true });
  const save = () =>
    writeFile(
      "../.data/release-archive/docs/acceptance/layout-generation-2026-11-03.json",
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
  await page.goto("/");
  for (const [input, expectedLayout] of cases) {
    const started = Date.now();
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/api/navigate"),
    );
    await page.getByRole("textbox", { name: "网址或搜索词" }).fill(input);
    await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
    let nav = await (await response).json();
    if (nav.status === "failed") {
      const retry = page.waitForResponse((r) =>
        r.url().endsWith("/api/retrypage"),
      );
      await page.getByRole("button", { name: "重新尝试", exact: true }).click();
      nav = await (await retry).json();
    }
    const deadline = Date.now() + 150000;
    let record;
    while (Date.now() < deadline) {
      record = responseSchema.parse(
        await (
          await request.post("/api/getpage", {
            data: { pageId: nav.pageId, jobId: null },
          })
        ).json(),
      ).page!;
      if (record.status !== "generating") break;
      await page.waitForTimeout(800);
    }
    expect(record?.status, record?.error ?? input).toBe("ready");
    expect(record!.source).toBe("live");
    const spec = record!.spec!;
    const flat = flatten(spec.blocks);
    evidence.push({
      input,
      pageId: record!.id,
      jobId: record!.currentJobId,
      design: spec.design,
      theme: spec.theme,
      blocks: flat.length,
      types: [...new Set(flat.map((b) => b.type))],
      elapsedMs: Date.now() - started,
    });
    await save();
    expect(spec.design?.layout).toBe(expectedLayout);
    await expect(page.locator("[data-page-layout]")).toHaveAttribute(
      "data-page-layout",
      expectedLayout,
    );
    await expect(page.locator("footer")).toHaveCount(0);
    await page.screenshot({
      path:
        "../.data/release-archive/docs/screenshots/layouts-live/" +
        expectedLayout +
        ".png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page
        .getByTestId("content-viewport")
        .evaluate((n) => n.scrollWidth > n.clientWidth + 1),
    ).toBe(false);
    await page.screenshot({
      path:
        "../.data/release-archive/docs/screenshots/layouts-live/" +
        expectedLayout +
        "-mobile.png",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  expect(new Set(evidence.map((e) => e.blocks)).size).toBeGreaterThan(1);
  expect(evidence.some((e) => Number(e.blocks) > 12)).toBe(true);
});
