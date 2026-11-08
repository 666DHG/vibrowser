import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("reported academic homepage retries and generates afresh in LIVE", async ({
  request,
  browser,
}) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  expect((await (await request.get("/health")).json()).mock).toBe(false);
  const input = "清华教师袁洋的个人学术主页.com";
  const evidence: any[] = [];
  await mkdir("../.data/release-archive/docs/screenshots/academic-fragments", {
    recursive: true,
  });
  async function verify(pageId: string, label: string) {
    const started = Date.now();
    let result: any;
    for (let i = 0; i < 1100; i++) {
      result = await (
        await request.post("/api/getpage", { data: { pageId } })
      ).json();
      if (result.page?.status !== "generating") break;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    evidence.push({
      label,
      input,
      pageId,
      jobId: result.job?.id,
      status: result.page?.status,
      error: result.page?.error,
      steps: result.job?.steps,
      elapsedMs: Date.now() - started,
      entityIds: result.page?.document?.entities.map((e: any) => e.id),
    });
    await writeFile(
      "../.data/release-archive/docs/acceptance/academic-fragments-live-2026-11-05.json",
      JSON.stringify(evidence, null, 2),
    );
    expect
      .soft(result.page?.status, label + ": " + result.page?.error)
      .toBe("ready");
    if (result.page?.status !== "ready") return;
    const record = result.page;
    const page = await browser.newPage();
    let requests = 0;
    page.on("request", (r) => {
      if (/\/api\/(navigate|retrypage|submitpageaction)$/.test(r.url()))
        requests++;
    });
    await page.addInitScript(
      (r) =>
        sessionStorage.setItem(
          "vibrowser.tabs.v2",
          JSON.stringify({
            activeTabId: "acceptance",
            tabs: [
              {
                id: "acceptance",
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
    const frame = page.frameLocator("iframe");
    await expect(frame.locator("h1").first()).toBeVisible();
    for (const binding of record.document.bindings.filter(
      (b: any) => b.field === "Title",
    )) {
      const entity = record.document.entities.find(
        (e: any) => e.id === binding.entityId,
      );
      await expect(
        frame.locator('[id="' + binding.elementId + '"]'),
      ).toHaveText(entity.title);
    }
    await page.waitForTimeout(300);
    await page.screenshot({
      path:
        "../.data/release-archive/docs/screenshots/academic-fragments/" +
        label +
        ".png",
    });
    expect(requests).toBe(0);
    await page.close();
  }
  const retry = await (
    await request.post("/api/retrypage", {
      data: {
        pageId: "43dc7f05-2fa1-4a46-9805-82e5176a4795",
        failedJobId: "757e12dd-1919-4f8c-9d0f-1aebce5699df",
      },
    })
  ).json();
  await verify(retry.pageId, "reported-page-retry");
  const fresh = await (
    await request.post("/api/navigate", { data: { input, mode: "research" } })
  ).json();
  expect(fresh.pageId).not.toBe(retry.pageId);
  await verify(fresh.pageId, "same-input-fresh");
});
