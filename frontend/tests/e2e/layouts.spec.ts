import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { pageSpecSchema, type PageBlock } from "../../src/shared/pageSpec";
const cases = [
  ["magazine", "editorial", "serif"],
  ["storefront", "storefront", "sans"],
  ["documentation", "documentation", "sans"],
  ["community", "community", "sans"],
  ["dashboard", "dashboard", "mono"],
  ["studio", "studio", "display"],
  ["directory-rich", "directory", "sans"],
] as const;
for (const [fixture, layout, typography] of cases) {
  test(
    layout + " layout, typography, responsive flow and navigation",
    async ({ page }) => {
      const spec = pageSpecSchema.parse(
        JSON.parse(
          await readFile(
            "../contracts/fixtures/valid/" + fixture + ".json",
            "utf8",
          ),
        ),
      );
      const requests: string[] = [];
      await page.route("**/api/navigate", async (route) => {
        requests.push(route.request().postDataJSON().input);
        await route.fulfill({
          json: {
            pageId: "00000000-0000-4000-8000-000000000001",
            jobId: "00000000-0000-4000-8000-000000000002",
            status: "ready",
          },
        });
      });
      await page.route("**/api/getpage", (route) =>
        route.fulfill({
          json: {
            page: {
              id: "00000000-0000-4000-8000-000000000001",
              address: "https://layout.example/",
              kind: "website",
              prompt: "layout.example",
              status: "ready",
              spec,
              currentJobId: "00000000-0000-4000-8000-000000000002",
              referrerId: null,
              error: null,
              source: "mock",
            },
            job: null,
          },
        }),
      );
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/");
      await page
        .getByRole("textbox", { name: "网址或搜索词" })
        .fill("layout.example");
      await page.getByRole("textbox", { name: "网址或搜索词" }).press("Enter");
      const rendered = page.locator("[data-page-layout]");
      await expect(rendered).toHaveAttribute("data-page-layout", layout);
      await expect(rendered).toHaveAttribute(
        "data-page-typography",
        typography,
      );
      const font = await rendered.evaluate(
        (node) => getComputedStyle(node).fontFamily,
      );
      if (typography === "serif") expect(font).toContain("Georgia");
      if (typography === "mono") expect(font).toContain("Consolas");
      if (typography === "display") expect(font).toContain("Bahnschrift");
      const aside = rendered.locator('[data-placement="aside"]');
      const main = rendered.locator('[data-placement="main"]');
      if ((await aside.count()) && (await main.count())) {
        const a = (await aside.first().boundingBox())!;
        const m = (await main.first().boundingBox())!;
        expect(Math.abs(a.x - m.x)).toBeGreaterThan(100);
      }
      await mkdir("../docs/screenshots/layouts", { recursive: true });
      await page.screenshot({
        path: "../docs/screenshots/layouts/" + fixture + ".png",
      });
      await rendered.getByRole("button").first().click();
      await expect.poll(() => requests.length).toBe(2);
      const flatten = (blocks: PageBlock[]): PageBlock[] =>
        blocks.flatMap((block) => [block, ...flatten(block.items)]);
      const target = flatten(spec.blocks).find((block) => block.target)?.target;
      expect(requests[1]).toBe(
        new URL(target!, "https://layout.example/").href,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(rendered).toBeVisible();
      const overflow = await page
        .getByTestId("content-viewport")
        .evaluate((node) => node.scrollWidth > node.clientWidth + 1);
      expect(overflow).toBe(false);
      if ((await aside.count()) && (await main.count())) {
        const a = (await aside.first().boundingBox())!;
        const m = (await main.first().boundingBox())!;
        expect(Math.abs(a.x - m.x)).toBeLessThan(2);
      }
      await page.screenshot({
        path: "../docs/screenshots/layouts/" + fixture + "-mobile.png",
      });
      expect(errors).toEqual([]);
    },
  );
}
