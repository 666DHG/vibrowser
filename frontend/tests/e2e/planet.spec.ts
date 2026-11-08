import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const min = (12 * Math.PI) / 180,
  max = (32 * Math.PI) / 180;
test("idle spin, bounded drag, inertia, reset and active tab lifecycle", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  const planet = page.getByTestId("ascii-planet"),
    characters = page.getByTestId("planet-characters");
  await expect(characters).not.toBeEmpty();
  const initial = await characters.textContent();
  await expect.poll(() => characters.textContent()).not.toBe(initial);
  const box = (await planet.boundingBox())!;
  expect(box.x + box.width).toBeGreaterThan(1400);
  expect(box.width).toBeGreaterThan(900);
  expect(box.height).toBeGreaterThan(750);
  const x = box.x + box.width * 0.3,
    y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 130, y + 800, { steps: 10 });
  await page.waitForTimeout(200);
  expect(Number(await planet.getAttribute("data-pitch"))).toBeLessThanOrEqual(
    max,
  );
  await page.mouse.move(x + 150, y + 770, { steps: 4 });
  await page.waitForTimeout(100);
  expect(Number(await planet.getAttribute("data-pitch"))).toBeLessThan(max);
  await page.mouse.up();
  const afterRelease = await planet.getAttribute("data-yaw");
  await expect
    .poll(() => planet.getAttribute("data-yaw"))
    .not.toBe(afterRelease);
  await planet.focus();
  await page.keyboard.press("Home");
  await expect
    .poll(async () => Number(await planet.getAttribute("data-pitch")))
    .toBeCloseTo((20 * Math.PI) / 180, 3);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(400);
  expect(
    Number(await planet.getAttribute("data-pitch")),
  ).toBeGreaterThanOrEqual(min);
  await page.getByRole("button", { name: "新建标签页", exact: true }).click();
  const originalPlanet = page.getByTestId("ascii-planet").first();
  await page.waitForTimeout(100);
  const paused = await originalPlanet.getAttribute("data-time");
  await page.waitForTimeout(250);
  expect(await originalPlanet.getAttribute("data-time")).toBe(paused);
  await page.getByRole("tab").first().click();
  await expect
    .poll(() => originalPlanet.getAttribute("data-time"))
    .not.toBe(paused);
});
test("reduced motion stays static and touch works in cropped mobile region", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${process.env.VIBROWSER_UI_PORT ?? 5173}/`);
  const planet = page.getByTestId("ascii-planet"),
    text = page.getByTestId("planet-characters");
  await expect(text).not.toBeEmpty();
  const original = await text.textContent();
  await page.waitForTimeout(250);
  expect(await text.textContent()).toBe(original);
  const box = (await planet.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(280);
  expect(box.height).toBeLessThanOrEqual(360);
  const session = await context.newCDPSession(page),
    x = box.x + box.width * 0.2,
    y = box.y + box.height * 0.5;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 65, y: y - 30 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(text).not.toHaveText(original!);
  const stopped = await text.textContent();
  await page.waitForTimeout(200);
  expect(await text.textContent()).toBe(stopped);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
test("fixed scene screenshots, responsive sizing and render performance", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.37;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await mkdir("../docs/screenshots/ascii-planet", { recursive: true });
  for (const [name, width, height] of [
    ["desktop", 1440, 960],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByTestId("planet-characters")).not.toBeEmpty();
    await page.waitForTimeout(100);
    await page.screenshot({
      path: `../docs/screenshots/ascii-planet/${name}.png`,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const performanceResult = await page.evaluate(async () => {
    // Vite serves the actual module used by the page; measure the maximum grid.
    const moduleUrl = "/src/pages/BrowserPage/functions/asciiPlanet.ts";
    const { planetLayout, projectPlanet, renderAsciiPlanet } = await import(
      /* @vite-ignore */ moduleUrl
    );
    const projection = projectPlanet(planetLayout(1200, 704, false));
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      renderAsciiPlanet(projection, { yaw: i * 0.01, pitch: 0.35 }, i * 0.033);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return {
      columns: projection.layout.columns,
      rows: projection.layout.rows,
      p95: times[94],
      maximum: times[99],
    };
  });
  expect(performanceResult.p95).toBeLessThan(33.3);
  await writeFile(
    "../docs/acceptance/planet-performance.json",
    JSON.stringify(performanceResult, null, 2),
  );
});

test("visibility, offscreen pause, resize continuity and frame pacing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  const planet = page.getByTestId("ascii-planet");
  await expect
    .poll(async () => Number(await planet.getAttribute("data-time")))
    .toBeGreaterThan(0.1);
  const beforeResize = Number(await planet.getAttribute("data-yaw"));
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.waitForTimeout(120);
  expect(
    Math.abs(Number(await planet.getAttribute("data-yaw")) - beforeResize),
  ).toBeLessThan(0.2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const paused = await planet.getAttribute("data-time");
  await page.waitForTimeout(300);
  expect(await planet.getAttribute("data-time")).toBe(paused);
  const beforeResume = Number(await planet.getAttribute("data-yaw"));
  await page.evaluate(() => {
    delete (document as unknown as Record<string, unknown>).hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(120);
  expect(
    Math.abs(Number(await planet.getAttribute("data-yaw")) - beforeResume),
  ).toBeLessThan(0.2);
  await page.setViewportSize({ width: 390, height: 500 });
  await page.getByTestId("content-viewport").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await page.waitForTimeout(150);
  const offscreen = await planet.getAttribute("data-time");
  await page.waitForTimeout(200);
  expect(await planet.getAttribute("data-time")).toBe(offscreen);
  await page.getByTestId("content-viewport").evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect.poll(() => planet.getAttribute("data-time")).not.toBe(offscreen);
  await page.setViewportSize({ width: 2200, height: 1200 });
  await page.waitForTimeout(200);
  const pacing = await page.evaluate(async () => {
    const node = document.querySelector('[data-testid="planet-characters"]')!;
    let updates = 0;
    const longTasks: number[] = [];
    const observer = new MutationObserver(() => updates++);
    observer.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const tasks = new PerformanceObserver((list) =>
      list.getEntries().forEach((entry) => longTasks.push(entry.duration)),
    );
    tasks.observe({ entryTypes: ["longtask"] });
    const started = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const seconds = (performance.now() - started) / 1000;
    observer.disconnect();
    tasks.disconnect();
    return { updates, seconds, fps: updates / seconds, longTasks };
  });
  expect(pacing.fps).toBeGreaterThan(24);
  expect(pacing.fps).toBeLessThan(32);
  expect(pacing.longTasks).toHaveLength(0);
  await writeFile(
    "../docs/acceptance/planet-frame-pacing.json",
    JSON.stringify(pacing, null, 2),
  );
});

test("seeded idle scene includes a transient background meteor", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.37;
  });
  await page.clock.install({ time: new Date("2026-11-08T00:00:00Z") });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await expect(page.getByTestId("planet-characters")).not.toBeEmpty();
  await page.clock.runFor(1700);
  await page.screenshot({
    path: "../docs/screenshots/ascii-planet/idle-meteor.png",
    animations: "disabled",
  });
  const first = await page.getByTestId("planet-characters").textContent();
  await page.clock.runFor(1500);
  await expect(page.getByTestId("planet-characters")).not.toHaveText(first!);
});
