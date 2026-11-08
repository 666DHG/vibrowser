import { test, expect } from "@playwright/test";
import { readFile, readdir, writeFile } from "node:fs/promises";
test("replay real design documents through the browser runtime without model requests", async ({
  browser,
}) => {
  const directory =
    process.env.VIBROWSER_DESIGN_REPLAY_DIR ?? "../.cache/design-acceptance/";
  const findings: object[] = [];
  for (const file of (await readdir(directory)).filter((f) =>
    /-new(?:-standard|-deep)?\.json$/.test(f),
  )) {
    const record = JSON.parse(await readFile(directory + file, "utf8"));
    if (!record.document) continue;
    const address = record.request
      ? JSON.parse(record.request.split("\n")[0]).target.address
      : "https://replay.example/";
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.route("**/api/listbookmarks", (r) =>
        r.fulfill({ json: { bookmarks: [] } }),
      );
      await page.route("**/api/navigate", (r) =>
        r.fulfill({
          json: { pageId: record.pageId, jobId: record.jobId, status: "ready" },
        }),
      );
      await page.route("**/api/getpage", (r) =>
        r.fulfill({
          json: {
            page: {
              id: record.pageId,
              address,
              kind: "website",
              prompt: record.input,
              status: "ready",
              spec: null,
              document: record.document,
              currentJobId: record.jobId,
              referrerId: null,
              error: null,
              source: "live",
              mode: record.mode,
              effort: record.effort ?? "standard",
            },
            job: null,
          },
        }),
      );
      await page.goto("http://127.0.0.1:5173/");

      await page
        .getByRole("textbox", { name: "网址或搜索词" })
        .fill(record.input);
      await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
      const frame = page.frameLocator("iframe");
      await expect(page.locator("iframe")).toHaveAttribute(
        "title",
        record.document.title,
      );
      await expect(frame.locator("body")).toBeVisible();
      await expect(frame.locator("body")).not.toHaveText("");
      let requests = 0;
      const listener = (r: { url(): string }) => {
        if (/\/api\/(navigate|submitpageaction|retrypage)$/.test(r.url()))
          requests++;
      };
      page.on("request", listener);
      const local: string[] = [];
      const limitations: string[] = [];
      for (const action of record.document.actions.filter(
        (a: { kind: string }) => a.kind === "Toggle",
      )) {
        const button = frame.locator(
          `[id=${JSON.stringify(action.elementId)}]`,
        );
        if (!(await button.isVisible())) continue;
        const region = frame.locator(`[id=${JSON.stringify(action.region)}]`);
        const before = await region.isVisible();
        await button.click();
        await expect(region).toBeVisible({ visible: !before });
        await button.click();
        local.push(action.id);
        break;
      }
      expect(requests).toBe(0);
      const copy = record.document.actions.find(
        (a: { kind: string }) => a.kind === "Copy",
      );
      let copyVerified = false;
      let copyContentPreserved: boolean | null = null;
      if (copy) {
        const button = frame.locator(`[id=${JSON.stringify(copy.elementId)}]`);
        if (await button.isVisible()) {
          const expectedText = await frame
            .locator(`[id=${JSON.stringify(copy.region)}]`)
            .innerText();
          const acceptedRaw = record.attempts?.find(
            (attempt: { outcome: string }) => attempt.outcome === "Accepted",
          )?.output;
          if (acceptedRaw) {
            const raw = JSON.parse(acceptedRaw);
            if (typeof raw.html === "string") {
              const originalText = await page.evaluate(
                ({ html, id }) =>
                  new DOMParser()
                    .parseFromString(html, "text/html")
                    .getElementById(id)?.textContent ?? null,
                { html: raw.html, id: copy.region as string },
              );
              if (originalText != null) {
                copyContentPreserved =
                  originalText.replace(/\s+/g, " ").trim() ===
                  expectedText.replace(/\s+/g, " ").trim();
                if (!copyContentPreserved)
                  limitations.push(
                    "Copy text differs from the accepted raw model response; successful clipboard dispatch does not prove content preservation.",
                  );
              }
            }
          }
          await page.evaluate(() => {
            Object.assign(window, { copiedTexts: [] as string[] });
            Object.defineProperty(navigator, "clipboard", {
              configurable: true,
              value: {
                writeText: async (text: string) => {
                  (
                    window as unknown as { copiedTexts: string[] }
                  ).copiedTexts.push(text);
                },
              },
            });
          });
          await button.click();
          await expect(
            frame
              .locator(`[data-state=${JSON.stringify(copy.stateKey)}]`)
              .first(),
          ).toHaveText("已复制");
          expect(
            await page.evaluate(
              () =>
                (window as unknown as { copiedTexts: string[] }).copiedTexts,
            ),
          ).toEqual([expectedText]);
          copyVerified = expectedText.trim().length > 0;
          if (!copyVerified)
            limitations.push(
              "Copy target is empty; runtime dispatch matched but useful copying was not verified.",
            );
        }
      }
      expect(requests).toBe(0);
      const filter =
        record.document.actions.find(
          (a: { kind: string; value?: string }) =>
            a.kind === "Filter" && a.value,
        ) ??
        record.document.actions.find(
          (a: { kind: string }) => a.kind === "Filter",
        );
      let filterVerified = false;
      if (filter) {
        const control = frame.locator(
          `[id=${JSON.stringify(filter.elementId)}]`,
        );
        const region = frame.locator(`[id=${JSON.stringify(filter.region)}]`);
        const markedItems = region.locator(
          `[data-${filter.field ?? "filter"}]`,
        );
        const items = (await markedItems.count())
          ? markedItems
          : region.locator(
              ":scope > :not(input,select,textarea,button,label,form)",
            );
        if (
          (await control.isVisible()) &&
          (await control.evaluate((e) =>
            ["BUTTON", "INPUT"].includes(e.tagName),
          ))
        ) {
          const values = await items.evaluateAll(
            (elements, field) =>
              elements.map(
                (child) =>
                  child.getAttribute("data-" + field) ??
                  child.textContent ??
                  "",
              ),
            filter.field ?? "filter",
          );
          const isInput = await control.evaluate((e) => e.tagName === "INPUT");
          const query = isInput
            ? (values
                .find((v) => v.trim())
                ?.trim()
                .split(/\s+/)[0] ?? "")
            : (filter.value ?? "");
          if (isInput) await control.fill(query);
          else await control.click();
          const expected = values.map((text) =>
            text.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
          );
          expect(
            await items.evaluateAll((elements) =>
              elements.map((child) => !(child as HTMLElement).hidden),
            ),
          ).toEqual(expected);
          filterVerified = expected.some(Boolean) && expected.some((v) => !v);
          const all = record.document.actions.find(
            (a: { kind: string; region?: string; value?: string }) =>
              a.kind === "Filter" && a.region === filter.region && !a.value,
          );
          if (isInput) await control.fill("");
          else if (all)
            await frame
              .locator(`[id=${JSON.stringify(all.elementId)}]`)
              .click();
        }
      }
      const sort = record.document.actions.find(
        (a: { kind: string }) => a.kind === "Sort",
      );
      let sortVerified = false;
      if (sort) {
        const control = frame.locator(`[id=${JSON.stringify(sort.elementId)}]`);
        const region = frame.locator(`[id=${JSON.stringify(sort.region)}]`);
        if (
          (await control.isVisible()) &&
          (await control.evaluate((e) =>
            ["SELECT", "BUTTON"].includes(e.tagName),
          ))
        ) {
          const values = await region.evaluate(
            (e, field) =>
              [...e.children].map(
                (child) =>
                  child.getAttribute("data-" + field) ??
                  child.textContent ??
                  "",
              ),
            sort.field ?? "sort",
          );
          const isSelect = await control.evaluate(
            (e) => e.tagName === "SELECT",
          );
          const direction = isSelect ? "desc" : (sort.value ?? "asc");
          const options = isSelect
            ? await control
                .locator("option:not([disabled])")
                .evaluateAll((options) =>
                  options.map((o) => (o as HTMLOptionElement).value),
                )
            : [direction];
          if (
            !options.includes(direction) ||
            !["asc", "desc"].includes(direction)
          ) {
            limitations.push(
              `Sort options ${options.join(",")} do not match the declared single-field direction contract; sorting not verified.`,
            );
          } else {
            if (isSelect) await control.selectOption(direction);
            else await control.click();
            expect(
              await region.evaluate(
                (e, field) =>
                  [...e.children].map(
                    (child) =>
                      child.getAttribute("data-" + field) ??
                      child.textContent ??
                      "",
                  ),
                sort.field ?? "sort",
              ),
            ).toEqual(
              [...values].sort(
                (a, b) =>
                  (direction === "desc" ? -1 : 1) *
                  a.localeCompare(b, undefined, { numeric: true }),
              ),
            );
            sortVerified = values.length > 1;
          }
        }
      }
      expect(requests).toBe(0);
      let anchorVerified = false;
      const anchor = record.document.actions.find(
        (a: { kind: string; target?: string }) =>
          a.kind === "Navigate" &&
          a.target?.startsWith("#") &&
          a.target.length > 1,
      );
      if (anchor) {
        const control = frame.locator(
          `[id=${JSON.stringify(anchor.elementId)}]`,
        );
        const target = frame.locator(
          `[id=${JSON.stringify(decodeURIComponent(anchor.target.slice(1)))}]`,
        );
        if (await control.isVisible()) {
          const before = requests;
          await control.click();
          await expect
            .poll(() =>
              target.evaluate((e) => {
                const rect = e.getBoundingClientRect();
                return rect.top >= -2 && rect.top < window.innerHeight;
              }),
            )
            .toBe(true);
          expect(requests).toBe(before);
          anchorVerified = true;
        }
      }
      // Native fragment links are valid v3 navigation even without an action record.
      if (!anchorVerified) {
        const links = frame.locator('a[href^="#"]');
        for (const control of await links.all()) {
          const href = await control.getAttribute("href");
          if (!href || href.length < 2 || !(await control.isVisible()))
            continue;
          const target = frame.locator(
            `[id=${JSON.stringify(decodeURIComponent(href.slice(1)))}]`,
          );
          if ((await target.count()) !== 1) continue;
          const before = requests;
          await control.click();
          await expect
            .poll(() =>
              target.evaluate((e) => {
                const rect = e.getBoundingClientRect();
                return rect.top >= -2 && rect.top < window.innerHeight;
              }),
            )
            .toBe(true);
          expect(requests).toBe(before);
          anchorVerified = true;
          break;
        }
      }
      const search = record.document.actions.find(
        (a: { kind: string }) => a.kind === "Search",
      );
      let searchSubmitted = false;
      if (search) {
        await page.route("**/api/submitpageaction", (r) => {
          const data = r.request().postDataJSON();
          expect(data.actionId).toBe(search.id);
          expect(data.values.q).toBe("主题检索");
          searchSubmitted = true;
          return r.fulfill({ status: 400, json: { message: "验收拦截提交" } });
        });
        const form = frame.locator(`[id=${JSON.stringify(search.elementId)}]`);
        if (await form.isVisible()) {
          await form.locator('[name="q"]').fill("主题检索");
          await form.locator('[name="q"]').press("Enter");
          await expect(page.getByText("验收拦截提交")).toBeVisible();
          await expect(form.locator('[name="q"]')).toHaveValue("主题检索");
        }
      }
      let navigationSubmitted = false;
      const link = record.document.actions.find(
        (a: { kind: string; target?: string }) =>
          a.kind === "Navigate" &&
          a.target &&
          a.target !== "/" &&
          !a.target.startsWith("#"),
      );
      if (link) {
        const control = frame.locator(`[id=${JSON.stringify(link.elementId)}]`);
        if (await control.isVisible()) {
          await page.route("**/api/navigate", (r) => {
            const data = r.request().postDataJSON();
            expect(new URL(data.input, address).href).toBe(
              new URL(link.target, address).href,
            );
            expect(data.referrerPageId).toBe(record.pageId);
            expect(data.sourceBlockId).toBe(link.id);
            navigationSubmitted = true;
            return r.fulfill({
              status: 400,
              json: { message: "验收拦截链接" },
            });
          });
          await control.click();
          await expect(page.getByText("验收拦截链接")).toBeVisible();
        }
      }
      findings.push({
        file,
        localActions: local,
        searchSubmitted,
        navigationSubmitted,
        anchorVerified,
        copyVerified,
        copyContentPreserved,
        filterVerified,
        sortVerified,
        limitations,
        extraModelCalls: 0,
      });
      page.off("request", listener);
    } catch (error) {
      findings.push({
        file,
        error: error instanceof Error ? error.message : String(error),
        extraModelCalls: 0,
      });
    } finally {
      await context.close();
    }
  }
  await writeFile(
    process.env.VIBROWSER_DESIGN_REPLAY_REPORT ??
      "../docs/screenshots/design-workflow/interaction-replay.json",
    JSON.stringify(findings, null, 2),
  );
  expect(findings.filter((row) => "error" in row)).toEqual([]);
});
