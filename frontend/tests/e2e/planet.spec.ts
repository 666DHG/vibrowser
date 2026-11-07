import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("ASCII planet rotates with pointer and keyboard and resets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  const planet = page.getByTestId("ascii-planet");
  const original = await planet.textContent();
  expect(original!.split("\n")).toHaveLength(30);
  expect(original!.split("\n").every((line) => line.length === 72)).toBe(true);
  expect(await planet.locator("svg,canvas,img").count()).toBe(0);
  const box = (await planet.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 75,
    box.y + box.height / 2 + 30,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(planet).not.toHaveText(original!);
  await planet.focus();
  await page.keyboard.press("Home");
  await expect(planet).toHaveText(original!);
  await page.keyboard.press("ArrowRight");
  await expect(planet).not.toHaveText(original!);
  await page.keyboard.press("Home");
  await planet.blur();
  await mkdir("../docs/screenshots/ascii-planet", { recursive: true });
  await page.screenshot({
    path: "../docs/screenshots/ascii-planet/desktop.png",
    animations: "disabled",
  });
});
test("touch drag rotates the text and mobile stays within viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(
    "http://127.0.0.1:" + (process.env.VIBROWSER_UI_PORT ?? "5173") + "/",
  );
  const planet = page.getByTestId("ascii-planet"),
    original = await planet.textContent(),
    box = (await planet.boundingBox())!;
  const session = await context.newCDPSession(page);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 65, y: y + 25 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(planet).not.toHaveText(original!);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await planet.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: "../docs/screenshots/ascii-planet/mobile.png",
    animations: "disabled",
  });
  await context.close();
});
