import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { readFile } from "../../tools/local-evidence.mjs";

test("targeted live retest after producer normalization fixes", async ({
  request,
  browser,
}) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  expect((await (await request.get("/health")).json()).mock).toBe(false);
  const evidence: any[] = [];
  async function wait(pageId: string, label: string) {
    const start = Date.now();
    let r: any;
    for (let i = 0; i < 1100; i++) {
      r = await (
        await request.post("/api/getpage", { data: { pageId } })
      ).json();
      if (r.page?.status !== "generating") break;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    evidence.push({
      label,
      pageId,
      jobId: r.job?.id,
      status: r.page?.status,
      error: r.page?.error,
      elapsedMs: Date.now() - start,
      steps: r.job?.steps,
      title: r.page?.document?.title,
    });
    await writeFile(
      "../.data/release-archive/docs/acceptance/reliability-retest-2026-11-05.json",
      JSON.stringify(evidence, null, 2),
    );
    expect.soft(r.page?.status, label + ": " + r.page?.error).toBe("ready");
    return r.page?.status === "ready" ? r.page : null;
  }
  const original = JSON.parse(
    await readFile(
      "../.data/release-archive/docs/acceptance/reliability-2026-11-05.json",
      "utf8",
    ),
  );
  const failed = original.find((r: any) => r.status === "failed");
  expect(failed).toBeTruthy();
  const retry = await (
    await request.post("/api/retrypage", {
      data: { pageId: failed.pageId, failedJobId: failed.jobId },
    })
  ).json();
  await wait(retry.pageId, "failed-page-explicit-retry");
  const nav = await (
    await request.post("/api/navigate", {
      data: { input: "清华大学袁洋老师的个人主页.com", mode: "research" },
    })
  ).json();
  const fresh = await wait(nav.pageId, "fresh-person-after-fix");
  if (fresh) {
    const page = await browser.newPage();
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
      fresh,
    );
    await page.goto("/");
    await expect
      .poll(
        async () =>
          (await page.frameLocator("iframe").locator("body").innerText())
            .length,
      )
      .toBeGreaterThan(100);
    await page.screenshot({
      path: "../.data/release-archive/docs/screenshots/reliability/person-after-fix.png",
    });
    await page.close();
  }
  const searched = await (
    await request.post("/api/getpage", {
      data: {
        pageId: original.find((r: any) => r.label === "site-search").pageId,
      },
    })
  ).json();
  const parent = await (
    await request.post("/api/getpage", {
      data: {
        pageId: original.find((r: any) => r.label === "person-a").pageId,
      },
    })
  ).json();
  const action = searched.page.document.actions.find(
    (a: any) =>
      a.kind === "Navigate" &&
      a.target &&
      !a.target.startsWith("#") &&
      new URL(a.target, searched.page.address).href !== parent.page.address &&
      new URL(a.target, searched.page.address).href !== searched.page.address,
  );
  expect(action).toBeTruthy();
  const detail = await (
    await request.post("/api/navigate", {
      data: {
        input: new URL(action.target, searched.page.address).href,
        referrerPageId: searched.page.id,
        sourceBlockId: action.id,
        mode: "research",
      },
    })
  ).json();
  await wait(detail.pageId, "actual-search-result-detail");
});
