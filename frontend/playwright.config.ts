import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve("../.cache/playwright");
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 30000,
  use: {
    channel: "chromium",
    baseURL: `http://127.0.0.1:${process.env.VIBROWSER_UI_PORT ?? 5173}`,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  reporter: [["list"]],
});
