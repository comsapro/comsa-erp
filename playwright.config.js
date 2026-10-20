import { defineConfig, devices } from "@playwright/test";
import { e2eEnv } from "./e2e/env.js";

const env = e2eEnv();
const port = env.E2E_PORT;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.js",
  use: {
    baseURL,
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${port} -H 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      ...env,
      AUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
    },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.js/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      testMatch: "**/*.spec.js",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
