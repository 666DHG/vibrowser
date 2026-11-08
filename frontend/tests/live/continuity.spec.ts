import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "../../tools/local-evidence.mjs";
import {
  responseSchema,
  type PageBlock,
  type PageRecord,
} from "../../src/shared/pageSpec";
import type { PageEntity } from "../../src/shared/pageEntity";

test("real forum listing, thread and onward link retain canonical facts along the click path", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.VIBROWSER_LIVE_SMOKE !== "true",
    "Explicit opt-in for model calls",
  );
  expect((await (await request.get("/health")).json()).mock).toBe(false);
  const evidencePath =
    "../.data/release-archive/docs/acceptance/continuity-2026-11-03.json";
  const screenshotDir = "../.data/release-archive/docs/screenshots/continuity";
  await mkdir(screenshotDir, { recursive: true });
  const earlier = await readFile(evidencePath, "utf8")
    .then(JSON.parse)
    .catch(() => []);
  const run = {
    startedAt: new Date().toISOString(),
    pages: [] as Record<string, unknown>[],
    result: "running",
  };
  const save = () =>
    writeFile(evidencePath, JSON.stringify([...earlier, run], null, 2), "utf8");
  const flat = (blocks: PageBlock[]): PageBlock[] =>
    blocks.flatMap((b) => [b, ...flat(b.items)]);
  const brand = (record: PageRecord) =>
    flat(record.spec!.blocks).find((b) => b.type === "navbar")?.title;
  const input = "forum.moon-night.example/boards/night-shift-20261103";
  const visited = new Set<string>();
  const load = async (
    action: () => Promise<void>,
    label: string,
    expected?: PageEntity,
  ) => {
    const started = Date.now();
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/api/navigate"),
    );
    await action();
    const navigationResponse = await response;
    const submitted = navigationResponse.request().postDataJSON();
    const nav = await navigationResponse.json();
    expect(navigationResponse.ok(), JSON.stringify(nav)).toBe(true);
    const deadline = Date.now() + 145000;
    let raw;
    do {
      raw = await (
        await request.post("/api/getpage", {
          data: { pageId: nav.pageId, jobId: null },
        })
      ).json();
      if (raw.page?.status !== "generating") break;
      await page.waitForTimeout(800);
    } while (Date.now() < deadline);
    const context = raw.page?.navigationContext;
    run.pages.push({
      label,
      submitted,
      cacheHit: nav.status === "ready",
      elapsedMs: Date.now() - started,
      pageId: raw.page?.id,
      jobId: raw.page?.currentJobId,
      status: raw.page?.status,
      error: raw.page?.error,
      schemaVersion: raw.page?.spec?.schemaVersion,
      source: raw.page?.source,
      stages: raw.job?.steps,
      title: raw.page?.spec?.title,
      theme: raw.page?.spec?.theme,
      design: raw.page?.spec?.design,
      expectedEntity: expected,
      actualSubject: raw.page?.spec?.entities?.find(
        (e: PageEntity) => e.id === raw.page?.spec?.subjectEntityId,
      ),
      context: context
        ? {
            characters: JSON.stringify(context).length,
            selected: context.selected,
            appearance: context.appearance,
            entities: context.entities.map((e: PageEntity) => ({
              id: e.id,
              title: e.title,
              author: e.author,
              replyCount: e.replyCount,
            })),
            ancestors: context.ancestors,
          }
        : null,
    });
    await save();
    const record = responseSchema.parse(raw).page!;
    expect(record.status, record.error ?? label).toBe("ready");
    expect(record.source).toBe("live");
    expect(record.spec!.schemaVersion).toBe(2);
    visited.add(record.address);
    if (expected) {
      const actual = record.spec!.entities.find((e) => e.id === expected.id)!;
      expect(actual).toBeTruthy();
      for (const key of [
        "title",
        "summary",
        "author",
        "publishedAt",
        "replyCount",
        "price",
        "legacyMeta",
      ] as const)
        if (expected[key] != null)
          expect(actual[key], key).toEqual(expected[key]);
      expect(record.spec!.subjectEntityId).toBe(expected.id);
      await expect(
        page
          .getByRole("heading", { name: expected.title, exact: true })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    }
    await expect(page.getByRole("tab", { selected: true })).toHaveText(
      record.spec!.title,
      { timeout: 10000 },
    );
    await page.getByTestId("content-viewport").evaluate((node) => {
      node.scrollTop = 0;
    });
    await expect(page.locator(".page-arrival")).toHaveCount(0);
    await expect(page.getByTestId("navigation-progress")).toHaveCount(0);
    await page.screenshot({ path: `${screenshotDir}/${label}.png` });
    return record;
  };
  try {
    await page.goto("/");
    const root = await load(async () => {
      await page.getByRole("textbox", { name: "网址或搜索词" }).fill(input);
      await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
    }, "listing");
    const first = flat(root.spec!.blocks).find(
      (b) =>
        b.type === "thread" &&
        b.target &&
        root.spec!.entities.some(
          (e) => e.id === b.entityId && e.author && e.replyCount != null,
        ),
    );
    expect(first, "forum must offer a structured thread").toBeTruthy();
    const entity = root.spec!.entities.find((e) => e.id === first!.entityId)!;
    const click = async (block: PageBlock, source: PageRecord) => {
      const button = page
        .locator(`[data-block-id="${block.id}"]`)
        .getByRole("button")
        .first();
      await button.scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
      await button.hover();
      await expect(page.getByTestId("link-preview")).toHaveText(
        new URL(block.target!, source.address).href,
      );
      await button.click();
    };
    const child = await load(() => click(first!, root), "thread", entity);
    expect(brand(child)).toBe(brand(root));
    expect(child.spec!.theme).toBe(root.spec!.theme);
    const onward = flat(child.spec!.blocks)
      .filter(
        (b) =>
          b.target &&
          !visited.has(new URL(b.target, child.address).href) &&
          new URL(b.target, child.address).origin ===
            new URL(child.address).origin,
      )
      .sort((a, b) => Number(!!b.entityId) - Number(!!a.entityId))[0];
    expect(onward, "thread must offer an onward link").toBeTruthy();
    const nextEntity = child.spec!.entities.find(
      (e) => e.id === onward.entityId,
    );
    const next = await load(() => click(onward, child), "onward", nextEntity);
    expect(brand(next)).toBe(brand(root));
    const before = next.currentJobId;
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    const cached = responseSchema.parse(
      await (
        await request.post("/api/getpage", {
          data: { pageId: next.id, jobId: null },
        })
      ).json(),
    );
    expect(cached.page!.currentJobId).toBe(before);
    run.result = "passed";
  } catch (error) {
    run.result = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await save();
  }
});
