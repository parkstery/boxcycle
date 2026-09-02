/**
 * Functions 에뮬레이터 포함 e2e — playwright 가 .env.emulator(VITE_FUNCTIONS_EMULATOR_HOST) 를 쓰도록 플래그를 켠다.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(webRoot, "../..");

const inner = process.argv.slice(2).join(" ");
if (!inner.trim()) {
  console.error("Usage: run-with-functions-emulator.mjs <playwright test …>");
  process.exit(1);
}

process.env.RTW_E2E_WITH_FUNCTIONS = "1";

const configPath = path.join(repoRoot, "firebase.json");
const quotedInner = `"${inner.replace(/"/g, '\\"')}"`;
const command =
  `firebase emulators:exec --only auth,firestore,database,functions ` +
  `--project boxcycle-dc2df --config "${configPath}" ${quotedInner}`;

const result = spawnSync(command, {
  cwd: webRoot,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
