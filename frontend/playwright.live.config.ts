import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve("../.cache/playwright");
export default defineConfig({
  testDir: "tests/live",
  workers: 1,
  timeout: 900000,
  use: {
    channel: "chromium",
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    trace: "off",
  },
  reporter: [["list"]],
});
