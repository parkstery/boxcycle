import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTABLE_NODE = path.join(
  __dirname,
  ".runner-cache/node-v20/node-v20.20.2-win-x64/node.exe",
);

export function resolveNode20Executable() {
  if (fs.existsSync(PORTABLE_NODE)) return PORTABLE_NODE;
  const major = Number(process.version.slice(1).split(".")[0]);
  if (major === 20) return process.execPath;
  throw new Error(
    `Node 20 이 필요합니다. 현재 ${process.version}. portable: ${PORTABLE_NODE} 또는 Node 20 을 설치하세요.`,
  );
}

export function node20Env(extra = {}) {
  const nodeExe = resolveNode20Executable();
  const nodeDir = path.dirname(nodeExe);
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const mergedPath = process.env[pathKey]
    ? `${nodeDir}${path.delimiter}${process.env[pathKey]}`
    : nodeDir;
  return {
    ...process.env,
    [pathKey]: mergedPath,
    RTW_ROUTE_TOKEN_NODE20: nodeExe,
    ...extra,
  };
}

export function assertNodeMajor20() {
  const nodeExe = resolveNode20Executable();
  const result = spawnSync(nodeExe, ["--version"], { encoding: "utf8" });
  const version = (result.stdout ?? "").trim();
  const major = Number(version.replace(/^v/, "").split(".")[0]);
  if (major !== 20) {
    throw new Error(`Node 20 이 필요합니다. 실제: ${version} (${nodeExe})`);
  }
  return { nodeExe, version };
}
