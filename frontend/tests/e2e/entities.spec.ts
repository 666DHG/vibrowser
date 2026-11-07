import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("entity-bound navigation submits exact source block and preserves displayed facts", async ({
  page,
}) => {
  const listing = JSON.parse(
    await readFile("../contracts/fixtures/valid/entities-list.json", "utf8"),
  );
  const detail = JSON.parse(
    await readFile("../contracts/fixtures/valid/entities-detail.json", "utf8"),
  );
  const target = listing.entities[0].id;
  detail.entities[0].id = target;
  detail.subjectEntityId = target;
  detail.blocks.forEach((b: { entityId?: string }) => {
    if (b.entityId) b.entityId = target;
  });
  const calls: {
    input: string;
    referrerPageId: string | null;
    sourceBlockId: string | null;
  }[] = [];
  await page.route("**/api/navigate", (route) => {
    const request = route.request().postDataJSON();
    calls.push(request);
    return route.fulfill({
      json: {
        pageId: request.sourceBlockId ? "child" : "parent",
        jobId: "job",
        status: "ready",
      },
    });
  });
  await page.route("**/api/getpage", (route) => {
    const id = route.request().postDataJSON().pageId;
    return route.fulfill({
      json: {
        page: {
          id,
          address: id === "child" ? target : "https://moon-coffee.example/",
          kind: "website",
          prompt: "forum",
          status: "ready",
          spec: id === "child" ? detail : listing,
          currentJobId: "job",
          referrerId: null,
          error: null,
          source: "mock",
        },
        job: null,
      },
    });
  });
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "网址或搜索词" });
  await input.fill("moon-coffee.example");
  await input.press("Enter");
  const link = page.getByRole("button", {
    name: "夜航回来的那一杯",
    exact: true,
  });
  await expect(link).toBeVisible();
  await expect(
    page.getByText("月面旅人 · 2026-11-03 20:14 · 37 条回复"),
  ).toBeVisible();
  await link.hover();
  await expect(page.getByTestId("link-preview")).toHaveText(target);
  await link.click();
  await expect.poll(() => calls.at(-1)?.sourceBlockId).toBe("thread-84458");
  expect(calls.at(-1)).toEqual({
    input: target,
    referrerPageId: "parent",
    sourceBlockId: "thread-84458",
    effort: "standard",
    mode: "imagination",
  });
  await expect(
    page.getByRole("heading", { name: "夜航回来的那一杯", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/显示第 1–2 条/)).toBeVisible();
  await expect(page.getByTestId("link-preview")).toHaveCount(0);
  await page.waitForTimeout(160);
  await page.getByRole("button", { name: "新建标签页", exact: true }).click();
  await page.getByRole("tab", { name: "月面树洞", exact: true }).click();
  expect(await page.locator(".page-arrival").count()).toBe(0);
});

test("bookmark URLs preview without navigating including cached search pages", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/listbookmarks", (route) =>
    route.fulfill({
      json: {
        bookmarks: [
          {
            id: "b1",
            pageId: "p1",
            title: "月球旅行",
            address: "vibe://search?q=moon",
            kind: "search",
            savedAt: "2026-11-03T12:00:00Z",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "书签", exact: true }).click();
  const link = page.getByRole("button", { name: "打开书签：月球旅行" });
  await link.focus();
  await expect(page.getByTestId("link-preview")).toHaveText(
    "vibe://search?q=moon",
  );
  await page.getByRole("button", { name: "删除书签：月球旅行" }).hover();
  await expect(page.getByTestId("link-preview")).toHaveCount(0);
});
