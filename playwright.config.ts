import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL,
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "npm run dev",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
});
