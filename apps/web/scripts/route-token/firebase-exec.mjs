import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveNode20Executable } from "./node20.mjs";

function resolveFirebaseJs() {
  const candidates = [
    path.join(process.env.APPDATA ?? "", "npm/node_modules/firebase-tools/lib/bin/firebase.js"),
    path.join(process.env.LOCALAPPDATA ?? "", "npm/node_modules/firebase-tools/lib/bin/firebase.js"),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error("firebase-tools CLI 를 찾을 수 없습니다. npm install -g firebase-tools");
}

export function runFirebaseEmulatorsExec({
  cwd,
  configPath,
  innerCommand,
  env,
  stdio = "inherit",
}) {
  const nodeExe = resolveNode20Executable();
  const firebaseJs = resolveFirebaseJs();
  const args = [
    firebaseJs,
    "emulators:exec",
    "--config",
    configPath,
    "--only",
    "auth,firestore,functions",
    "--project",
    "demo-rtw-route-token",
    innerCommand,
  ];
  const result = spawnSync(nodeExe, args, {
    cwd,
    env,
    stdio,
    encoding: stdio === "inherit" ? undefined : "utf8",
    shell: false,
  });
  return { nodeExe, firebaseJs, result };
}
