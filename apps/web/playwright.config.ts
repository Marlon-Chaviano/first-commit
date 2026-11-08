import { defineConfig, devices } from "@playwright/test";

const PORT = 3300;
const ci = Boolean(process.env.CI);

/**
 * End-to-end tests against the real site, with no database or Redis: the pages render from the
 * registry files and every service is optional, which is exactly what has to keep working.
 *   pnpm --filter web e2e            (starts `next dev` on :3300, or reuses one already running)
 *   PW_CHROMIUM_PATH=/path/to/chrome pnpm --filter web e2e   (use an installed Chromium browser)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  // `next dev` compiles each page on its first visit.
  timeout: ci ? 30_000 : 120_000,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    // CI tests the production build; locally the dev server is faster to start.
    command: ci ? `NEXT_DIST_DIR=.next-e2e pnpm exec next build && NEXT_DIST_DIR=.next-e2e pnpm exec next start -p ${PORT}` : `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !ci,
    timeout: 300_000,
    env: { DATABASE_URL: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
