/**
 * register-inputs — 단계 0: rider·cycle GLB 및 결합 스크립트를 결합의 고정 입력으로 등록.
 *
 * 라이더를 다시 만드는 게 아니다. "이 rider GLB·cycle GLB·결합 스크립트가 결합의 입력임"을
 * SHA-256·경로·Blender버전과 함께 manifest 에 못박아, 좌표·다리길이 재발견 반복을 막는다.
 * AABB·노드/본 목록은 Blender 추출(extract-glb-meta.py)이 채운다(이 스크립트는 해시·구조 관리).
 *
 * 실행: node scripts/rider-cycle-fit/register-inputs.mjs
 *   [--rider <path>] [--cycle <path>] [--fitik <path>] [--joints <path>]
 *   [--geometry <path>] [--exporter <path>] [--blender <version>]
 * 산출: .out/inputs/manifest-<inputHash>.json  (+ 최신 포인터 manifest-latest.json)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const HARNESS_ROOT = __dirname;
export const WEB_ROOT = path.join(__dirname, "..", "..");
export const INPUTS_ROOT = path.join(__dirname, ".out", "inputs");

/** 결합 입력 정본 경로(기본값). 인수인계 memory v24-cyclefit-handoff 기준. */
export const DEFAULT_INPUTS = {
  rider: "C:/Users/kdrea/OneDrive/Documents/img/output_v2_optimized/lod0/stylized_cyclist_v2_lod0.glb",
  cycle: "C:/Users/kdrea/OneDrive/Documents/img/v2_4_cyclefit/cycle-only.glb",
  fitik: "C:/Users/kdrea/OneDrive/Documents/img/v2_4_cyclefit/fit_ik.py",
  joints: "C:/Users/kdrea/OneDrive/Documents/img/v2_4_cyclefit/ik-joints-v2.json",
  geometry: path.join(WEB_ROOT, "src/lib/riderPrototype/geometry.json"),
  exporter: path.join(WEB_ROOT, "scripts/rider-preview/export-ik-joints-v2.mjs"),
};

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { ...DEFAULT_INPUTS, blender: "" };
  for (let i = 0; i < a.length; i += 2) {
    const k = a[i]?.replace(/^--/, "");
    if (k && k in out) out[k] = a[i + 1];
    else if (k === "blender") out.blender = a[i + 1];
  }
  return out;
}

export function fileSha256(abs) {
  return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}
export function kstNow() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return {
    compact: `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}-${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}${p(kst.getUTCSeconds())}`,
    human: `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())} ${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}:${p(kst.getUTCSeconds())} KST`,
  };
}

/** 입력 해시 — (라벨+경로+내용) 정렬 결합 SHA-256. 하나라도 바뀌면 다른 해시. */
export function computeInputHash(inputs) {
  const keys = ["rider", "cycle", "fitik", "joints", "geometry", "exporter"];
  const h = crypto.createHash("sha256");
  const perFile = {};
  for (const k of keys) {
    const abs = inputs[k];
    if (!fs.existsSync(abs)) throw new Error(`입력 누락: ${k} = ${abs}`);
    const fh = fileSha256(abs);
    perFile[k] = { path: abs, sha256: fh, bytes: fs.statSync(abs).size };
    h.update(`${k}\0${abs}\0`, "utf8");
    h.update(fs.readFileSync(abs));
    h.update("\0");
  }
  h.update(`blender\0${inputs.blender}\0`, "utf8");
  const full = h.digest("hex");
  return { full, short: full.slice(0, 8), perFile };
}

function main() {
  const inputs = parseArgs();
  const { full, short, perFile } = computeInputHash(inputs);
  const t = kstNow();
  fs.mkdirSync(INPUTS_ROOT, { recursive: true });
  const manifest = {
    $note: "rider-cycle-fit 결합 입력 기준선(단계 0). 라이더 재제작 아님 — 고정 입력 선언.",
    inputHash: short,
    inputHashFull: full,
    registeredAt: t.human,
    blenderVersion: inputs.blender || "(미기록 — --blender 로 지정 권장)",
    files: perFile,
    // AABB·노드/본·단위·축·원점은 extract-glb-meta.py 가 채운다(단계 0 완결용).
    riderMeta: { aabb: null, nodes: null, bones: null, unit: null, axis: null, origin: null, previewPng: null, note: "extract-glb-meta.py 로 채울 것" },
    cycleMeta: { aabb: null, nodes: null, unit: null, axis: null, origin: null, previewPng: null, note: "extract-glb-meta.py 로 채울 것" },
  };
  const outPath = path.join(INPUTS_ROOT, `manifest-${short}.json`);
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(INPUTS_ROOT, "manifest-latest.json"), JSON.stringify({ inputHash: short, path: outPath, registeredAt: t.human }, null, 2));

  console.log(`✔ 입력 기준선 등록: inputHash=${short}  (${t.human})`);
  console.log(`  manifest: ${outPath}`);
  for (const [k, v] of Object.entries(perFile)) {
    console.log(`  ${k.padEnd(9)} ${v.sha256.slice(0, 12)}  ${v.bytes}B  ${v.path}`);
  }
  if (!inputs.blender) console.log("  ⚠ --blender <version> 미지정 — 재현성 위해 Blender 버전 기록 권장(예 5.2.0).");
  console.log("  ⚠ AABB·노드/본은 extract-glb-meta.py 로 채워 단계 0 완결.");
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("register-inputs.mjs")) {
  main();
}
