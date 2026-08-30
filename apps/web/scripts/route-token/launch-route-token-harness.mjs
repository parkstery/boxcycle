import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNode20Executable } from "./node20.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessPath = path.join(__dirname, "run-route-token-harness.mjs");
const nodeExe = resolveNode20Executable();

const result = spawnSync(nodeExe, [harnessPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: path.join(__dirname, "../.."),
  env: process.env,
});

process.exitCode = result.status ?? 1;
