/**
 * R1 단계 C — 3회 연속 루프 e2e 런처.
 * CI: `npm -w boxcycle-web run test:e2e:ride-continue-phase-c`
 * 수동(dev:emulator): `RIDE_CONTINUE_PHASE_A_BASE_URL=http://127.0.0.1:5002 node scripts/ride-continue/phase-c-three-loop.mjs`
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "../..");
const baseUrl = process.env.RIDE_CONTINUE_PHASE_A_BASE_URL;

if (baseUrl) {
  console.log(`[phase-c] dev server mode — ${baseUrl} (Playwright 직접 실행은 test spec 참고)`);
  console.log("[phase-c] firebase emulators:exec 로 실행하려면: npm -w boxcycle-web run test:e2e:ride-continue-phase-c");
  process.exit(0);
}

const result = spawnSync(
  "npx",
  [
    "firebase",
    "emulators:exec",
    "--only",
    "auth,firestore,database,functions",
    "--project",
    "boxcycle-dc2df",
    "--config",
    "../../firebase.json",
    "playwright test ride-continue-phase-c --workers=1",
  ],
  { cwd: webRoot, stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
