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
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const HARNESS_ROOT = __dirname;
export const WEB_ROOT = path.join(__dirname, "..", "..");
export const REPO_ROOT = path.join(WEB_ROOT, "..", "..");
export const INPUTS_ROOT = path.join(__dirname, ".out", "inputs");
/** Blender 메타 추출 스크립트(apps/web 밖 — Blender는 three 의존 없음) */
export const EXTRACT_PY = path.join(REPO_ROOT, "blender", "rider-cycle-fit", "extract-glb-meta.py");
export const DEFAULT_BLENDER_EXE = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";

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
  const out = { ...DEFAULT_INPUTS, blender: "", blenderExe: DEFAULT_BLENDER_EXE, skipMeta: false };
  for (let i = 0; i < a.length; i += 1) {
    const k = a[i]?.replace(/^--/, "");
    if (k === "skipMeta") { out.skipMeta = true; continue; }
    if (k && (k in out || k === "blender" || k === "blenderExe")) { out[k] = a[i + 1]; i += 1; }
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

/** Blender extract-glb-meta.py 실행 → @@META@@ 줄 파싱. 실패 시 null(경고). */
export function extractGlbMeta(glbPath, blenderExe, previewOut) {
  if (!fs.existsSync(EXTRACT_PY)) return { error: `extract-glb-meta.py 없음: ${EXTRACT_PY}` };
  if (!fs.existsSync(blenderExe)) return { error: `Blender 실행파일 없음: ${blenderExe} (--blenderExe 로 지정)` };
  try {
    const args = ["--background", "--python", EXTRACT_PY, "--", glbPath];
    if (previewOut) args.push(previewOut);
    const out = execFileSync(blenderExe, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    const line = out.split(/\r?\n/).find((l) => l.startsWith("@@META@@"));
    if (!line) return { error: "@@META@@ 출력 없음(Blender 오류?)" };
    return { meta: JSON.parse(line.slice("@@META@@".length).trim()) };
  } catch (e) {
    return { error: `Blender 실행 실패: ${e.message.split("\n")[0]}` };
  }
}

function main() {
  const inputs = parseArgs();
  const { full, short, perFile } = computeInputHash(inputs);
  const t = kstNow();
  fs.mkdirSync(INPUTS_ROOT, { recursive: true });
  const previewDir = path.join(INPUTS_ROOT, `preview-${short}`);

  // ── GLB 메타 추출(단계 0 완결) ──
  let riderMeta = { note: "미추출 — --skipMeta 또는 Blender 실패" };
  let cycleMeta = { note: "미추출 — --skipMeta 또는 Blender 실패" };
  const metaErrors = [];
  if (!inputs.skipMeta) {
    fs.mkdirSync(previewDir, { recursive: true });
    const rIn = path.join(previewDir, "rider-preview.png");
    const cIn = path.join(previewDir, "cycle-preview.png");
    const r = extractGlbMeta(inputs.rider, inputs.blenderExe, rIn);
    const c = extractGlbMeta(inputs.cycle, inputs.blenderExe, cIn);
    if (r.meta) riderMeta = r.meta; else metaErrors.push(`rider: ${r.error}`);
    if (c.meta) cycleMeta = c.meta; else metaErrors.push(`cycle: ${c.error}`);
  }

  const manifest = {
    $note: "rider-cycle-fit 결합 입력 기준선(단계 0). 라이더 재제작 아님 — 고정 입력 선언.",
    inputHash: short,
    inputHashFull: full,
    registeredAt: t.human,
    blenderVersion: inputs.blender || "(미기록 — --blender 로 지정 권장)",
    files: perFile,
    riderMeta,
    cycleMeta,
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
  if (inputs.skipMeta) {
    console.log("  ⚠ --skipMeta — AABB·노드 미추출(단계 0 미완결).");
  } else {
    const rOk = riderMeta.aabb ? `mesh${riderMeta.meshCount}·본${Object.values(riderMeta.bones || {})[0]?.length ?? 0}·전고 z${riderMeta.aabb.size_mm.z_up}mm` : "실패";
    const cOk = cycleMeta.aabb ? `mesh${cycleMeta.meshCount}·전장 x${cycleMeta.aabb.size_mm.x}mm` : "실패";
    console.log(`  ✔ riderMeta: ${rOk}`);
    console.log(`  ✔ cycleMeta: ${cOk}`);
    console.log(`  preview PNG: ${previewDir}`);
    for (const e of metaErrors) console.log(`  ⚠ 메타 추출: ${e}`);
    if (!metaErrors.length && riderMeta.aabb && cycleMeta.aabb) console.log("  ✔ 단계 0 완결 — AABB·노드/본·프리뷰 기록됨.");
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("register-inputs.mjs")) {
  main();
}
