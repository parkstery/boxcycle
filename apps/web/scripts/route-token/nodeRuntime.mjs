import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 하네스가 쓸 Node 실행 파일을 고른다.
 *
 * 요구 버전은 **`functions/package.json` 의 `engines.node` 하나에서만** 읽는다 —
 * 종전에는 이 파일이 `20` 을 직접 박고 있어, Cloud Functions 런타임을 올릴 때
 * 두 곳을 따로 고쳐야 했고 한쪽만 바꾸면 조용히 어긋났다(2026-09-25 일반화).
 *
 * 왜 버전을 맞추나 — route-token 계약은 배포된 런타임과 같은 Node 에서 검증해야
 * 의미가 있다. 그래서 「이상」이 아니라 「일치」를 요구한다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_PKG = path.resolve(__dirname, "../../../../functions/package.json");

/** functions 가 선언한 런타임 메이저. 이 저장소에서 Node 버전의 단일 진실이다. */
export function requiredNodeMajor() {
  const raw = JSON.parse(fs.readFileSync(FUNCTIONS_PKG, "utf8"))?.engines?.node;
  const major = Number(String(raw ?? "").replace(/[^\d].*$/, ""));
  if (!Number.isFinite(major) || major <= 0) {
    throw new Error(`functions/package.json 의 engines.node 를 읽지 못했습니다: ${JSON.stringify(raw)}`);
  }
  return major;
}

function portableNodePath(major) {
  const dir = path.join(__dirname, `.runner-cache/node-v${major}`);
  if (!fs.existsSync(dir)) return null;
  // node-v24.x.y-win-x64/node.exe — 패치 버전은 고정하지 않는다.
  for (const entry of fs.readdirSync(dir)) {
    const exe = path.join(dir, entry, "node.exe");
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

export function resolveNodeExecutable() {
  const major = requiredNodeMajor();
  const portable = portableNodePath(major);
  if (portable) return portable;
  const hostMajor = Number(process.version.slice(1).split(".")[0]);
  if (hostMajor === major) return process.execPath;
  throw new Error(
    `Node ${major} 가 필요합니다. 현재 ${process.version}. ` +
      `portable: ${path.join(__dirname, `.runner-cache/node-v${major}`)} 또는 Node ${major} 를 설치하세요.`,
  );
}

export function nodeRuntimeEnv(extra = {}) {
  const nodeExe = resolveNodeExecutable();
  const nodeDir = path.dirname(nodeExe);
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const mergedPath = process.env[pathKey]
    ? `${nodeDir}${path.delimiter}${process.env[pathKey]}`
    : nodeDir;
  return {
    ...process.env,
    [pathKey]: mergedPath,
    RTW_ROUTE_TOKEN_NODE: nodeExe,
    ...extra,
  };
}

export function assertNodeMajor() {
  const major = requiredNodeMajor();
  const nodeExe = resolveNodeExecutable();
  const result = spawnSync(nodeExe, ["--version"], { encoding: "utf8" });
  const version = (result.stdout ?? "").trim();
  const actual = Number(version.replace(/^v/, "").split(".")[0]);
  if (actual !== major) {
    throw new Error(`Node ${major} 가 필요합니다. 실제: ${version} (${nodeExe})`);
  }
  return { nodeExe, version, major };
}
