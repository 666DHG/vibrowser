import { test, expect } from "@playwright/test";
test("v3 worker persists search and append as immutable versions", async ({
  request,
}) => {
  test.skip(process.env.VIBROWSER_V3_MOCK_SMOKE !== "true");
  expect((await (await request.get("/health")).json()).mock).toBe(true);
  async function wait(id: string) {
    let result: any;
    await expect
      .poll(
        async () => {
          result = await (
            await request.post("/api/getpage", { data: { pageId: id } })
          ).json();
          return result.page.status;
        },
        { timeout: 10000 },
      )
      .not.toBe("generating");
    expect(result.page.status, result.page.error).toBe("ready");
    return result.page;
  }
  const nav = await (
    await request.post("/api/navigate", {
      data: { input: "论坛.example/v3-mock-" + Date.now() },
    })
  ).json();
  const original = await wait(nav.pageId);
  expect(original.document.schemaVersion).toBe(3);
  const append = original.document.actions.find(
    (a: any) => a.kind === "Append",
  );
  const payload = {
    pageId: original.id,
    actionId: append.id,
    revision: original.currentJobId,
    requestId: crypto.randomUUID(),
    values: {},
  };
  const submitted = await (
    await request.post("/api/submitpageaction", { data: payload })
  ).json();
  const duplicate = await (
    await request.post("/api/submitpageaction", { data: payload })
  ).json();
  expect(duplicate.pageId).toBe(submitted.pageId);
  const updated = await wait(submitted.pageId);
  expect(updated.id).not.toBe(original.id);
  expect(updated.document.html).toContain("新的讨论内容");
  expect((await wait(original.id)).document.html).toBe(original.document.html);
  const search = updated.document.actions.find((a: any) => a.kind === "Search");
  const query = await (
    await request.post("/api/submitpageaction", {
      data: {
        pageId: updated.id,
        actionId: search.id,
        revision: updated.currentJobId,
        requestId: crypto.randomUUID(),
        values: { q: "选课" },
      },
    })
  ).json();
  const results = await wait(query.pageId);
  expect(new URL(results.address).searchParams.get("q")).toBe("选课");
  expect(results.document.title).toContain("选课");
});
