import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { resolveDevPort } from "../../../../../apps/web/devPort";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "../../../../../apps/web");
const underEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (underEmulator) process.env.RIDE_VERIFY_LIVE = "1";
const DEV_PORT = resolveDevPort(underEmulator && process.env.RTW_E2E_WITH_FUNCTIONS === "1");
const DEV_URL = `http://127.0.0.1:${DEV_PORT}`;

export default defineConfig({
  testDir: __dirname,
  testMatch: "capture-card.spec.ts",
  workers: 1,
  retries: 0,
  use: {
    baseURL: DEV_URL,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev:localhost -- --mode emulator",
    cwd: webRoot,
    url: DEV_URL,
    reuseExistingServer: false,
    env: {
      RTW_DEV_PORT: String(DEV_PORT),
      VITE_USE_EMULATOR: "1",
    },
  },
});
