import { mkdirSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve("../.cache/playwright");
for (const directory of ["acceptance", "screenshots"]) {
  mkdirSync(resolve("../.data/release-archive/docs", directory), {
    recursive: true,
  });
}
export default defineConfig({
  testDir: "tests/live",
  outputDir: "test-results-live",
  workers: 1,
  timeout: 900000,
  use: {
    channel: "chromium",
    actionTimeout: 30000,
    baseURL: `http://127.0.0.1:${process.env.VIBROWSER_UI_PORT ?? 5173}`,
    viewport: { width: 1440, height: 1000 },
    trace: "off",
  },
  reporter: [["list"]],
});
