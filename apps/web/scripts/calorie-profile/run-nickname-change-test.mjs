/**
 * nickname-change.emulator.test.ts 실행기 — 제품 코드의 import.meta.env 를 에뮬레이터 배선으로 덮는다.
 * firebase emulators:exec 안에서만 부른다(package.json test:profile-edit:emulator).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = {
  ...process.env,
  RTW_VITE_ENV_OVERRIDES: JSON.stringify({
    VITE_USE_EMULATOR: "1",
    VITE_FIREBASE_PROJECT_ID: "boxcycle-dc2df",
    VITE_FIREBASE_API_KEY: "fake-api-key",
    VITE_FIREBASE_AUTH_DOMAIN: "boxcycle-dc2df.firebaseapp.com",
    VITE_FIREBASE_APP_ID: "1:0:web:0",
  }),
};
const r = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    "./scripts/s42/register-vite-env.mjs",
    "--test",
    "--test-force-exit",
    "scripts/calorie-profile/nickname-change.emulator.test.ts",
  ],
  { cwd: webRoot, stdio: "inherit", env },
);
process.exit(r.status ?? 1);
