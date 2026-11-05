import { test, expect, APIRequestContext, Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const evidence: any[] = JSON.parse(
  await readFile(
    "../docs/acceptance/web-interactions-2026-11-05.json",
    "utf8",
  ).catch(() => "[]"),
);
async function get(request: APIRequestContext, id: string) {
  return (await request.post("/api/getpage", { data: { pageId: id } })).json();
}
async function wait(request: APIRequestContext, id: string) {
  let result: any;
  for (let i = 0; i < 200; i++) {
    result = await get(request, id);
    if (result.page.status !== "generating") break;
    await new Promise((r) => setTimeout(r, 750));
  }
  evidence.push({
    pageId: id,
    jobId: result.page.currentJobId,
    status: result.page.status,
    error: result.page.error,
    steps: result.job.steps,
    title: result.page.document?.title,
  });
  await writeFile(
    "../docs/acceptance/web-interactions-2026-11-05.json",
    JSON.stringify(evidence, null, 2),
  );
  expect(result.page.status, result.page.error ?? "generation").toBe("ready");
  return result.page;
}
async function open(page: Page, record: any) {
  await page.goto("/");
  await page.addInitScript(
    (r) =>
      sessionStorage.setItem(
        "vibrowser.tabs.v2",
        JSON.stringify({
          activeTabId: "chain",
          tabs: [
            {
              id: "chain",
              title: r.title ?? r.document?.title ?? r.input ?? r.address,
              draft: r.input ?? r.address,
              view: "ready",
              entries: [
                {
                  pageId: r.pageId ?? r.id,
                  input: r.input ?? r.address,
                  address: r.address ?? r.input,
                },
              ],
              index: 0,
            },
          ],
        }),
      ),
    record,
  );
  await page.reload();
  const expected = (await get(page.request, record.pageId ?? record.id)).page;
  await expect(page.locator("iframe")).toHaveAttribute(
    "title",
    expected.document.title,
  );
  await expect
    .poll(
      async () =>
        (await page.frameLocator("iframe").locator("body").innerText()).length,
    )
    .toBeGreaterThan(50);
}
async function clickAction(
  page: Page,
  request: APIRequestContext,
  doc: any,
  action: any,
  query?: string,
) {
  expect(action, "required action exists").toBeTruthy();
  const frame = page.frameLocator("iframe");
  const element = frame.locator('[id="' + action.elementId + '"]');
  const response = page.waitForResponse((r) =>
    r
      .url()
      .endsWith(
        action.kind === "Navigate" ? "/api/navigate" : "/api/submitpageaction",
      ),
  );
  if (action.kind === "Search") {
    await element.locator('[name="q"]').fill(query!);
    await element.locator('[name="q"]').press("Enter");
  } else await element.click();
  const nav = await (await response).json();
  expect(nav.pageId).toBeTruthy();
  const result = await wait(request, nav.pageId);
  await expect(page.locator("iframe")).toHaveAttribute(
    "title",
    result.document.title,
  );
  return result;
}
test("real v3 interaction chains", async ({ page, request }) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  const records = JSON.parse(
    await readFile("../docs/acceptance/web-documents-2026-11-05.json", "utf8"),
  );
  for (const kind of (
    process.env.VIBROWSER_CHAIN_KINDS ?? "forum,shop,docs"
  ).split(",")) {
    const record = [...records]
      .reverse()
      .find(
        (r: any) =>
          r.kind === kind &&
          (kind !== "shop" || r.variant === 1) &&
          (r.retests?.at(-1)?.status ?? r.status) === "ready",
      );
    expect(record, "ready " + kind).toBeTruthy();
    let current = (await get(request, record.pageId)).page;
    await open(page, record);
    if (kind === "shop") {
      const filter = current.document.actions.find(
        (a: any) => a.kind === "Filter",
      );
      const sort = current.document.actions.find((a: any) => a.kind === "Sort");
      expect(filter).toBeTruthy();
      expect(sort).toBeTruthy();
      const f = page
        .frameLocator("iframe")
        .locator('[id="' + filter.elementId + '"]');
      if ((await f.evaluate((e) => e.tagName)) === "INPUT") {
        await f.fill("不存在的类别");
        await f.fill("");
      } else {
        await f.selectOption({ index: 1 });
        await f.selectOption({ index: 0 });
      }
      const sorter = page
        .frameLocator("iframe")
        .locator('[id="' + sort.elementId + '"]');
      if ((await sorter.evaluate((e) => e.tagName)) === "SELECT")
        await sorter.selectOption({ index: 1 });
      else await sorter.click();
    }
    if (kind !== "shop") {
      if (kind === "docs") {
        const toggle = current.document.actions.find(
          (a: any) => a.kind === "Toggle",
        );
        expect(toggle).toBeTruthy();
        await page
          .frameLocator("iframe")
          .locator('[id="' + toggle.elementId + '"]')
          .click();
      }
      if (process.env.VIBROWSER_RESUME_SEARCH) {
        const id = process.env.VIBROWSER_RESUME_SEARCH;
        const saved = (await get(request, id)).page;
        if (saved.status === "failed")
          await request.post("/api/retrypage", {
            data: { pageId: id, failedJobId: saved.currentJobId },
          });
        current = await wait(request, id);
        await open(page, current);
      } else {
        current = await clickAction(
          page,
          request,
          current.document,
          current.document.actions.find((a: any) => a.kind === "Search"),
          kind === "forum" ? "选课" : "快速开始",
        );
      }
    }
    const entity =
      current.document.entities.find(
        (e: any) =>
          e.kind ===
          (kind === "shop"
            ? "product"
            : kind === "forum"
              ? "thread"
              : "article"),
      ) ?? current.document.entities[0];
    const action =
      current.document.actions.find(
        (a: any) =>
          a.kind === "Navigate" &&
          entity &&
          new URL(a.target, current.address).href === entity.id,
      ) ??
      current.document.actions.find(
        (a: any) => a.kind === "Navigate" && a.target !== "/",
      );
    current = await clickAction(page, request, current.document, action);
    if (entity) {
      const inherited = current.document.entities.find(
        (e: any) => e.id === entity.id,
      );
      expect(inherited?.title).toBe(entity.title);
      for (const field of ["author", "replyCount", "price"])
        if (entity[field] != null)
          expect(inherited[field]).toEqual(entity[field]);
    }
    if (kind === "forum") {
      const toggle = current.document.actions.find(
        (a: any) => a.kind === "Toggle",
      );
      expect(toggle).toBeTruthy();
      await page
        .frameLocator("iframe")
        .locator('[id="' + toggle.elementId + '"]')
        .click();
      current = await clickAction(
        page,
        request,
        current.document,
        current.document.actions.find((a: any) => a.kind === "Append"),
      );
    }
    if (kind === "shop") {
      const set = current.document.actions.find((a: any) => a.kind === "Set");
      const increment = current.document.actions.find(
        (a: any) => a.kind === "Increment",
      );
      expect(set).toBeTruthy();
      expect(increment).toBeTruthy();
      const spec = page
        .frameLocator("iframe")
        .locator('[id="' + set.elementId + '"]');
      if ((await spec.evaluate((e) => e.tagName)) === "SELECT")
        await spec.selectOption({ index: 1 });
      else await spec.click();
      await page
        .frameLocator("iframe")
        .locator('[id="' + increment.elementId + '"]')
        .click();
    }
    await page.screenshot({
      path: "../docs/screenshots/web-documents/" + kind + "-interaction.png",
    });
  }
});
