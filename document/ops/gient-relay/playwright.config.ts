import { defineConfig, devices } from "@playwright/test";

const underEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (underEmulator) {
  process.env.RIDE_VERIFY_LIVE = "1";
}

const DEV_PORT = Number(process.env.RTW_DEV_PORT ?? 5010);
const DEV_URL = `http://127.0.0.1:${DEV_PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: /measure-g2\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  use: {
    baseURL: DEV_URL,
    trace: "on-first-retry",
    headless: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev:localhost -w boxcycle-web",
    cwd: "../../..",
    url: DEV_URL,
    env: underEmulator
      ? { VITE_USE_EMULATOR: "1", RTW_DEV_PORT: String(DEV_PORT) }
      : { RTW_DEV_PORT: String(DEV_PORT) },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
