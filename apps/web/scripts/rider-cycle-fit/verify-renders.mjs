/**
 * 렌더 완전성 검증기 — 시각 보고 지시 §5.
 *
 * 하나라도 빠지면 **종료코드 1** 로 실패한다. 실패 시 보고·승인·제품 GLB 반영을 금지한다.
 * 개발자가 "대표 이미지 몇 장"으로 보고하는 것을 구조적으로 막는 장치다.
 *
 * 실행: node verify-renders.mjs <candidateDir> [--before <dir>]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  requiredImageIds, CONTACT_SHEETS, PEDAL_PHASES, PHASE_VIEWS, QUALITY,
} from "./required-views.mjs";

const argv = process.argv.slice(2);
const dir = argv.find((a) => !a.startsWith("--"));
const beforeIdx = argv.indexOf("--before");
const beforeDir = beforeIdx >= 0 ? argv[beforeIdx + 1] : null;
// Before/After 비교 단계에서는 --before 누락이 경고가 아니라 실패다(지시).
const requireBefore = argv.includes("--require-before");

if (!dir) {
  console.error("사용법: node verify-renders.mjs <candidateDir> [--before <dir>] [--require-before]");
  process.exit(2);
}

/** PNG 헤더에서 해상도를 읽고 해시·크기를 계산한다. */
function pngMeta(p) {
  const raw = fs.readFileSync(p);
  let width = null, height = null;
  if (raw.length > 24 && raw.toString("ascii", 12, 16) === "IHDR") {
    width = raw.readUInt32BE(16);
    height = raw.readUInt32BE(20);
  }
  const st = fs.statSync(p);
  return {
    sha256: crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16),
    bytes: raw.length,
    width,
    height,
    // 시간대 혼선 방지: 표시는 로컬, 비교는 epoch(ms)로 한다.
    //   manifest 는 파이썬 datetime.now()(로컬)를 문자열로 적고, JS Date 는 그 문자열을
    //   로컬로 파싱하므로 epoch 끼리 비교하면 일치한다. toISOString()(UTC)과 섞으면 9시간 어긋난다.
    mtime: new Date(st.mtimeMs - st.mtime.getTimezoneOffset() * 0).toLocaleString("sv-SE"),
    mtimeMs: st.mtimeMs,
  };
}

const fail = [];
const warn = [];
const ok = [];

const manifestPath = path.join(dir, "render-manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`✘ render-manifest.json 없음: ${manifestPath}`);
  process.exit(1);
}
const mf = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// 1) 필수 이미지 전수 존재
const required = requiredImageIds();
const missing = required.filter((id) => !fs.existsSync(path.join(dir, `${id}.png`)));
if (missing.length) fail.push(`필수 이미지 누락 ${missing.length}장: ${missing.join(", ")}`);
else ok.push(`필수 이미지 ${required.length}장 전부 존재`);

// 2) 필수 위상 0/90/180/270 전부
const degs = PEDAL_PHASES.map((p) => p.deg);
const missingPhase = degs.filter((d) =>
  PHASE_VIEWS.some((v) => !fs.existsSync(path.join(dir, `PHASE_${d}_${v.id}.png`))));
if (missingPhase.length) fail.push(`위상 불완전: ${missingPhase.join("°, ")}°`);
else ok.push(`위상 ${degs.join("/")}° 전부 완비`);

// 3) 각 위상에 전신 + 접점 확대가 모두
for (const d of degs) {
  const need = ["FULL", "FOOT_L", "FOOT_R"];
  const miss = need.filter((v) => !fs.existsSync(path.join(dir, `PHASE_${d}_${v}.png`)));
  if (miss.length) fail.push(`위상 ${d}° 에 ${miss.join(",")} 없음(전신·접점 필수)`);
}

// 4) 동일 candidateId
const dirName = path.basename(dir);
if (mf.candidateId && dirName !== mf.candidateId && dirName !== "latest") {
  fail.push(`candidateId 불일치: 폴더 ${dirName} vs manifest ${mf.candidateId}`);
} else ok.push(`candidateId 일치: ${mf.candidateId}`);

// 5) contact sheet 존재
const missingSheet = CONTACT_SHEETS.filter((s) => !fs.existsSync(path.join(dir, s)));
if (missingSheet.length) fail.push(`종합판 없음: ${missingSheet.join(", ")}`);
else ok.push(`종합판 ${CONTACT_SHEETS.length}장 존재`);

// 5b) 품질 — 빈/작은 이미지, 해상도 미달, 재사용 배제(지시)
const live = {};
for (const id of required) {
  const p = path.join(dir, `${id}.png`);
  if (!fs.existsSync(p)) continue;
  live[id] = pngMeta(p);
}
const tooSmall = Object.entries(live).filter(([, m]) => m.bytes < QUALITY.minBytes);
if (tooSmall.length) {
  fail.push(`빈/과소 이미지 ${tooSmall.length}장(<${QUALITY.minBytes}B): ` +
    tooSmall.map(([n, m]) => `${n}=${m.bytes}B`).join(", "));
} else if (Object.keys(live).length) ok.push(`파일 크기 하한 통과(≥${QUALITY.minBytes}B)`);

const badRes = Object.entries(live).filter(
  ([, m]) => !m.width || m.width < QUALITY.minWidth || m.height < QUALITY.minHeight);
if (badRes.length) {
  fail.push(`해상도 미달 ${badRes.length}장(<${QUALITY.minWidth}x${QUALITY.minHeight}): ` +
    badRes.map(([n, m]) => `${n}=${m.width}x${m.height}`).join(", "));
} else if (Object.keys(live).length) ok.push(`해상도 ≥${QUALITY.minWidth}x${QUALITY.minHeight}`);

// 서로 다른 뷰가 같은 픽셀 = 카메라 미적용/이미지 재사용
const byHash = {};
for (const [n, m] of Object.entries(live)) (byHash[m.sha256] ||= []).push(n);
const dups = Object.values(byHash).filter((v) => v.length > 1);
if (dups.length) {
  fail.push(`동일 픽셀 이미지 ${dups.length}조 — 카메라 미적용/재사용 의심: ` +
    dups.map((v) => v.join("≡")).join(" | "));
} else if (Object.keys(live).length) ok.push("모든 뷰가 서로 다른 픽셀");

// manifest 기록과 실제 파일이 일치하는가(이전 candidate 이미지 재사용 차단)
if (mf.images) {
  const drift = Object.entries(live).filter(
    ([n, m]) => mf.images[n] && mf.images[n].sha256 !== m.sha256);
  if (drift.length) {
    fail.push(`manifest 해시 불일치 ${drift.length}장 — 렌더 후 파일이 바뀜: ` +
      drift.map(([n]) => n).join(", "));
  } else ok.push("manifest 해시와 실제 파일 일치");
  const unrecorded = Object.keys(live).filter((n) => !mf.images[n]);
  if (unrecorded.length) fail.push(`manifest 미기록 ${unrecorded.length}장: ${unrecorded.join(", ")}`);
} else {
  fail.push("manifest 에 images(해시·크기·해상도·시각) 없음 — 재생성 필요");
}

// 이미지는 렌더 루프 **시작 이후**에 만들어져야 한다. 그보다 오래되면 이전 후보 재사용.
if (mf.renderStartedAt) {
  // manifest 시각은 파이썬 로컬시각 문자열. JS Date 도 로컬로 파싱하므로 epoch 비교가 맞다.
  const st = new Date(mf.renderStartedAt).getTime();
  const stale = Object.entries(live).filter(([, m]) => m.mtimeMs < st - 5000);
  if (stale.length) {
    fail.push(`renderStartedAt(${mf.renderStartedAt}) 이전 이미지 ${stale.length}장 — 재사용 의심: ` +
      stale.map(([n]) => n).join(", "));
  } else ok.push(`생성 시각 일관(렌더 시작 ${mf.renderStartedAt} 이후)`);
} else {
  fail.push("manifest 에 renderStartedAt 없음 — render-all.py 재실행 필요");
}

// 6) Before/After 동일 조건
if (requireBefore && !beforeDir) {
  fail.push("Before/After 비교 단계인데 --before 가 없음(지시: 경고 아닌 실패)");
}
if (beforeDir) {
  const bPath = path.join(beforeDir, "render-manifest.json");
  if (!fs.existsSync(bPath)) {
    fail.push(`--before manifest 없음: ${bPath}`);
  } else {
    const bmf = JSON.parse(fs.readFileSync(bPath, "utf8"));
    if (!bmf.inputHash || !mf.inputHash || bmf.inputHash !== mf.inputHash) {
      fail.push(`Before/After inputHash 불일치/누락: ${bmf.inputHash ?? "없음"} vs ${mf.inputHash ?? "없음"}`);
    }
    for (const k of ["scale", "lean", "profile"]) {
      if (String(bmf.params?.[k]) !== String(mf.params?.[k])) {
        fail.push(`Before/After ${k} 불일치: ${bmf.params?.[k]} vs ${mf.params?.[k]}`);
      }
    }
    const bMissing = required.filter((id) => !fs.existsSync(path.join(beforeDir, `${id}.png`)));
    if (bMissing.length) fail.push(`Before 세트 불완전 ${bMissing.length}장`);
    if (JSON.stringify(bmf.resolution) !== JSON.stringify(mf.resolution)) {
      fail.push(`Before/After 해상도 불일치: ${bmf.resolution} vs ${mf.resolution}`);
    }
    if (!fail.length) ok.push("Before/After 조건 일치(inputHash·scale·lean·profile·해상도·세트)");
  }
} else if (!requireBefore) {
  warn.push("--before 미지정 — Before/After 비교는 검증하지 않음(비교 단계면 --require-before 로 실패 처리)");
}

// 7) manifest 자체 정합
if (mf.missing?.length) fail.push(`manifest 가 누락 ${mf.missing.length}장을 기록: ${mf.missing.join(", ")}`);

console.log("=== verify-renders — 렌더 완전성(시각 보고 지시 §5) ===\n");
for (const o of ok) console.log(`  ✔ ${o}`);
for (const w of warn) console.log(`  ⚠ ${w}`);
for (const f of fail) console.log(`  ✘ ${f}`);
console.log();

if (fail.length) {
  console.log(`✘ 실패 ${fail.length}건 — 보고·승인·제품 GLB 반영 금지.`);
  process.exit(1);
}
console.log("✔ 렌더 완전성 통과. 종합판부터 표시한 뒤 개별 원본을 전수 표시할 것.");
