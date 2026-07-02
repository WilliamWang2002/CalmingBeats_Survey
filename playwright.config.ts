import { defineConfig } from "@playwright/test";

const TEST_PORT = Number(process.env.E2E_PORT ?? 3100);
const TEST_DB =
  process.env.E2E_MONGODB_URI ?? "mongodb://localhost:27017/calmingbeats-survey-e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${TEST_PORT}`,
    trace: "on-first-retry"
  },
  webServer: {
    command: `pnpm exec next dev -p ${TEST_PORT}`,
    url: `http://127.0.0.1:${TEST_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      MONGODB_URI: TEST_DB,
      SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-survey-session-secret"
    }
  }
});
