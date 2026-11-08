import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "../../tools/local-evidence.mjs";

test("live research topics, exploration, site search and mode isolation", async ({
  browser,
  request,
}) => {
  test.skip(process.env.VIBROWSER_LIVE_SMOKE !== "true");
  expect((await (await request.get("/health")).json()).mock).toBe(false);
  await mkdir("../.data/release-archive/docs/screenshots/research", {
    recursive: true,
  });
  const evidence: any[] =
    process.env.VIBROWSER_RESEARCH_RESUME === "true"
      ? JSON.parse(
          await readFile(
            "../.data/release-archive/docs/acceptance/research-2026-11-05.json",
            "utf8",
          ),
        )
      : [];
  const save = () =>
    writeFile(
      "../.data/release-archive/docs/acceptance/research-2026-11-05.json",
      JSON.stringify(evidence, null, 2),
    );
  async function wait(id: string, label: string) {
    const started = Date.now();
    let result: any;
    for (let i = 0; i < 300; i++) {
      result = await (
        await request.post("/api/getpage", { data: { pageId: id } })
      ).json();
      if (
        result.job?.status === "waiting" ||
        result.page?.status !== "generating"
      )
        break;
      await new Promise((r) => setTimeout(r, 800));
    }
    const sources = await (
      await request.post("/api/getpagesources", { data: { pageId: id } })
    ).json();
    evidence.push({
      label,
      pageId: id,
      jobId: result.job?.id,
      status: result.page?.status,
      error: result.page?.error,
      mode: result.page?.mode,
      title: result.page?.document?.title,
      elapsedMs: Date.now() - started,
      steps: result.job?.steps,
      research: result.research,
      sources: sources.sources,
    });
    await save();
    expect(
      result.page?.status,
      `${label}: ${result.page?.error ?? JSON.stringify(result.research)}`,
    ).toBe("ready");
    return result.page;
  }
  async function open(record: any) {
    const page = await browser.newPage();
    await page.addInitScript(
      (r) =>
        sessionStorage.setItem(
          "vibrowser.tabs.v2",
          JSON.stringify({
            activeTabId: "research",
            tabs: [
              {
                id: "research",
                title: r.document.title,
                draft: r.prompt,
                view: "ready",
                browsingMode: r.mode,
                entries: [
                  {
                    pageId: r.id,
                    address: r.address,
                    input: r.prompt,
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
    await expect(page.locator("iframe")).toHaveAttribute(
      "title",
      record.document.title,
    );
    await expect
      .poll(
        async () =>
          (await page.frameLocator("iframe").locator("body").innerText())
            .length,
      )
      .toBeGreaterThan(80);
    return page;
  }
  const records: any[] = [];
  for (const [label, input] of [
    ["person", "清华大学袁洋老师的个人主页.com"],
    ["institution", "清华大学交叉信息研究院介绍.com"],
    ["knowledge", "深入了解Transformer注意力机制.com"],
  ]) {
    const prior = [...evidence].reverse().find((r) => r.label === label);
    let record: any;
    if (prior) {
      const current = await (
        await request.post("/api/getpage", { data: { pageId: prior.pageId } })
      ).json();
      if (current.page?.status === "failed") {
        await request.post("/api/retrypage", {
          data: {
            pageId: prior.pageId,
            failedJobId: current.page.currentJobId,
          },
        });
        record = await wait(prior.pageId, label);
      } else record = current.page;
    } else {
      const nav = await (
        await request.post("/api/navigate", {
          data: { input, mode: "research" },
        })
      ).json();
      record = await wait(nav.pageId, label);
    }
    records.push(record);
    expect(record.sourceCount).toBeGreaterThan(0);
    const page = await open(record);
    await page.screenshot({
      path: `../.data/release-archive/docs/screenshots/research/${label}.png`,
    });
    await page
      .getByRole("button", { name: `来源 ${record.sourceCount}`, exact: true })
      .click();
    await expect(
      page.getByRole("complementary", { name: "网页来源" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "查看原文" }).first(),
    ).toHaveAttribute("href", /^https?:\/\//);
    await page.screenshot({
      path: `../.data/release-archive/docs/screenshots/research/${label}-sources.png`,
    });
    await page.close();
  }
  const person = records[0];
  let page = await open(person);
  const search = person.document.actions.find((a: any) => a.kind === "Search");
  expect(search, "person site search").toBeTruthy();
  const form = page
    .frameLocator("iframe")
    .locator(`[id="${search.elementId}"]`);
  const submit = page.waitForResponse((r) =>
    r.url().endsWith("/api/submitpageaction"),
  );
  await form.locator('[name="q"]').fill("研究方向");
  await form.locator('[name="q"]').press("Enter");
  const searched = await wait(
    (await (await submit).json()).pageId,
    "person-site-search",
  );
  expect(searched.mode).toBe("research");
  await expect(page.locator("iframe")).toHaveAttribute(
    "title",
    searched.document.title,
  );
  await page.screenshot({
    path: "../.data/release-archive/docs/screenshots/research/person-search.png",
  });
  const action = searched.document.actions.find(
    (a: any) =>
      a.kind === "Navigate" && a.target !== "/" && !a.target.startsWith("#"),
  );
  expect(action, "person detail link").toBeTruthy();
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/navigate"),
  );
  await page
    .frameLocator("iframe")
    .locator(`[id="${action.elementId}"]`)
    .click();
  const detail = await wait(
    (await (await response).json()).pageId,
    "person-detail",
  );
  expect(detail.mode).toBe("research");
  await expect(page.locator("iframe")).toHaveAttribute(
    "title",
    detail.document.title,
  );
  await page.screenshot({
    path: "../.data/release-archive/docs/screenshots/research/person-detail.png",
  });
  await page.close();
  const nav = await (
    await request.post("/api/navigate", {
      data: {
        input: person.prompt,
        mode: "imagination",
        referrerPageId: person.id,
      },
    })
  ).json();
  const imagination = await wait(nav.pageId, "imagination-control");
  expect(imagination.mode).toBe("imagination");
  expect(imagination.sourceCount).toBe(0);
  expect(imagination.id).not.toBe(person.id);
  page = await open(imagination);
  await page.screenshot({
    path: "../.data/release-archive/docs/screenshots/research/imagination-control.png",
  });
  await page.close();
  const bookmark = await (
    await request.post("/api/savebookmark", { data: { pageId: person.id } })
  ).json();
  expect(bookmark.mode).toBe("research");
  evidence.push({
    label: "restart-bookmark",
    bookmarkId: bookmark.id,
    pageId: person.id,
    jobId: person.currentJobId,
    title: person.document.title,
    sourceCount: person.sourceCount,
  });
  await save();
});
