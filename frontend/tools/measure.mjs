import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { frameSource } from "./webRuntime.mjs";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(
  import.meta.dirname,
  "../../.cache/playwright",
);
const { chromium } = await import("playwright");

export async function measureDocument(document, options = {}) {
  const browser = await chromium.launch({
    headless: true,
    channel: "chromium",
    timeout: 10000,
  });
  const abort = () => {
    void browser.close().catch(() => {});
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    if (options.signal?.aborted) throw new Error("measurement timeout");
    const reports = [];
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
        viewport,
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      context.setDefaultTimeout(7000);
      await context.route("**/*", (route) => route.abort());
      const page = await context.newPage();
      await page.setContent(
        '<iframe sandbox="allow-scripts" style="border:0;position:fixed;inset:0;width:100%;height:100%"></iframe>',
      );
      const instance = crypto.randomUUID();
      await page.evaluate(
        ({ source, instance }) => {
          window.measureReady = false;
          window.addEventListener("message", (e) => {
            if (
              e.source === document.querySelector("iframe").contentWindow &&
              e.data?.instance === instance &&
              e.data?.type === "ready"
            )
              window.measureReady = true;
          });
          document.querySelector("iframe").srcdoc = source;
        },
        {
          source: frameSource(document, instance, crypto.randomUUID()),
          instance,
        },
      );
      await page.waitForFunction(() => window.measureReady, undefined, {
        timeout: 7000,
      });
      const frame = page.frames().find((f) => f.parentFrame());
      await frame.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(80);
      const report = await frame.evaluate(({ width, height }) => {
        const visible = (e) => {
          const s = getComputedStyle(e);
          const r = e.getBoundingClientRect();
          return (
            s.display !== "none" &&
            s.visibility !== "hidden" &&
            r.width > 0 &&
            r.height > 0
          );
        };
        const horizontalScroll = (e) => {
          let parent = e.parentElement;
          while (
            parent &&
            parent !== document.body &&
            parent !== document.documentElement
          ) {
            const style = getComputedStyle(parent);
            if (
              ["auto", "scroll"].includes(style.overflowX) &&
              parent.scrollWidth > parent.clientWidth + 2
            ) {
              const rect = parent.getBoundingClientRect();
              return {
                containerId: parent.id,
                clientWidth: parent.clientWidth,
                scrollWidth: parent.scrollWidth,
                viewportLeft: rect.left + parent.clientLeft,
                viewportRight:
                  rect.left + parent.clientLeft + parent.clientWidth,
              };
            }
            parent = parent.parentElement;
          }
          return null;
        };
        const describe = (e) => {
          const r = e.getBoundingClientRect(),
            s = getComputedStyle(e);
          return {
            id: e.id,
            tag: e.tagName.toLowerCase(),
            text: e.textContent.trim().slice(0, 180),
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            fontSize: s.fontSize,
            lineHeight: s.lineHeight,
            fontFamily: s.fontFamily,
            horizontalScroll: horizontalScroll(e),
          };
        };
        const elements = [...document.body.querySelectorAll("*")].filter(
          visible,
        );
        const overflow = elements.filter((e) => {
          const r = e.getBoundingClientRect();
          if (
            r.right <= document.documentElement.clientWidth + 2 &&
            r.left >= -2
          )
            return false;
          let parent = e.parentElement;
          while (
            parent &&
            parent !== document.body &&
            parent !== document.documentElement
          ) {
            const s = getComputedStyle(parent);
            if (["auto", "scroll", "hidden", "clip"].includes(s.overflowX))
              return false;
            parent = parent.parentElement;
          }
          return true;
        });
        const select = (selector, limit) =>
          [...document.querySelectorAll(selector)]
            .filter(visible)
            .slice(0, limit)
            .map(describe);
        return {
          width,
          height,
          scrollWidth: Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
          ),
          scrollHeight: Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
          ),
          overflowIds: overflow
            .slice(0, 40)
            .map((e) => e.id || e.tagName.toLowerCase()),
          headings: select("h1,h2,h3,h4,h5,h6", 40),
          controls: select("a,button,input,select,textarea,summary", 64),
          regions: select("main,article,section,aside,nav,header,footer", 30),
        };
      }, viewport);
      reports.push(report);
      if (options.screenshotPrefix)
        await page.screenshot({
          path: options.screenshotPrefix + "-" + viewport.width + ".png",
          fullPage: false,
        });
      await context.close();
    }
    return { viewports: reports, error: null };
  } finally {
    options.signal?.removeEventListener("abort", abort);
    await browser.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 2097152) throw new Error("input too large");
      chunks.push(chunk);
    }
    const result = await measureDocument(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
      { signal: controller.signal },
    );
    process.stdout.write(JSON.stringify(result));
  } catch (e) {
    process.stdout.write(JSON.stringify({ viewports: [], error: e.message }));
  } finally {
    clearTimeout(timer);
  }
}
