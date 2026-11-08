import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("fresh generation reliability and entity-bound exploration", async ({
  browser,
  request,
}) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  expect((await (await request.get("/health")).json()).mock).toBe(false);
  const evidence: any[] = [];
  await mkdir("../.data/release-archive/docs/screenshots/reliability", {
    recursive: true,
  });
  const save = () =>
    writeFile(
      "../.data/release-archive/docs/acceptance/reliability-2026-11-05.json",
      JSON.stringify(evidence, null, 2),
    );
  async function wait(
    pageId: string,
    label: string,
    input: string,
    mode: string,
  ) {
    const started = Date.now();
    let r: any;
    for (let i = 0; i < 1100; i++) {
      r = await (
        await request.post("/api/getpage", { data: { pageId } })
      ).json();
      if (r.page?.status !== "generating" || r.job?.status === "waiting") break;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    evidence.push({
      label,
      input,
      mode,
      pageId,
      jobId: r.job?.id,
      status: r.page?.status,
      error: r.page?.error,
      elapsedMs: Date.now() - started,
      steps: r.job?.steps,
      title: r.page?.document?.title,
      bindings: r.page?.document?.bindings?.length,
      inlineBindings:
        r.page?.document?.html?.split("data-entity-id=").length - 1,
    });
    await save();
    expect.soft(r.page?.status, label + ": " + r.page?.error).toBe("ready");
    return r.page?.status === "ready" ? r.page : null;
  }
  const nonce = Date.now();
  const cases = [
    {
      label: "person-a",
      input: "一个关于清华大学袁洋老师的主页.dev/reliability-" + nonce,
      mode: "research",
    },
    {
      label: "person-b",
      input: "清华大学袁洋老师的个人主页.com/reliability-" + nonce,
      mode: "research",
    },
    {
      label: "forum",
      input: "清华树洞.com/reliability-" + nonce,
      mode: "imagination",
    },
  ];
  let person: any;
  for (const c of cases) {
    const nav = await (
      await request.post("/api/navigate", {
        data: { input: c.input, mode: c.mode },
      })
    ).json();
    const record = await wait(nav.pageId, c.label, c.input, c.mode);
    if (!record) continue;
    if (!person && c.mode === "research") person = record;
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
      record,
    );
    await page.goto("/");
    const body = page.frameLocator("iframe").locator("body");
    await expect
      .poll(async () => (await body.innerText()).length)
      .toBeGreaterThan(100);
    await page.waitForTimeout(2000);
    await page.screenshot({
      path:
        "../.data/release-archive/docs/screenshots/reliability/" +
        c.label +
        ".png",
    });
    await page.close();
  }
  if (person) {
    const search = person.document.actions.find(
      (a: any) => a.kind === "Search",
    );
    expect.soft(search, "personal homepage search").toBeTruthy();
    if (search) {
      const nav = await (
        await request.post("/api/submitpageaction", {
          data: {
            pageId: person.id,
            actionId: search.id,
            revision: person.currentJobId,
            requestId: "reliability-" + nonce,
            values: { q: "研究方向" },
          },
        })
      ).json();
      const searched = await wait(
        nav.pageId,
        "site-search",
        "研究方向",
        "research",
      );
      if (searched) {
        const a = searched.document.actions.find(
          (a: any) =>
            a.kind === "Navigate" &&
            a.target &&
            !a.target.startsWith("#") &&
            new URL(a.target, searched.address).href !== person.address &&
            new URL(a.target, searched.address).href !== searched.address,
        );
        expect.soft(a, "search result detail").toBeTruthy();
        if (a) {
          const nav = await (
            await request.post("/api/navigate", {
              data: {
                input: new URL(a.target, searched.address).href,
                referrerPageId: searched.id,
                sourceBlockId: a.id,
                mode: "research",
              },
            })
          ).json();
          await wait(nav.pageId, "detail", a.target, "research");
        }
      }
    }
  }
});
