import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const contractRel = "apps/web/scripts/route-token/route-token-contract.mjs";

if (!fs.existsSync(path.join(repoRoot, "firebase.json"))) {
  console.error("[route-token] firebase.json not found at", repoRoot);
  process.exit(1);
}

const childEnv = {
  ...process.env,
  RTW_ROUTE_TOKEN_HARNESS: "1",
  VITE_DIRECTIONS_DIRECT: "0",
};

const command = `firebase emulators:exec --only "auth,firestore,functions" --project demo-rtw-route-token "node ${contractRel}"`;

const result = spawnSync(command, {
  cwd: repoRoot,
  env: childEnv,
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error("[route-token] failed to spawn firebase:", result.error.message);
  process.exit(1);
}

process.exit(result.status === 0 ? 0 : result.status ?? 1);
