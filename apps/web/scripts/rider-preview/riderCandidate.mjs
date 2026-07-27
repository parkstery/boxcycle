/**
 * Rider Candidate — 후보 추적 체계 공용 모듈 (candidateId·source hash·경로·제품 승격).
 *
 * ⚠ 제품 GLB 게이트 (사용자 지시 2026-07-25): 승인 전 제품 파일
 *   `apps/web/public/rider/prototype/rider-lowpoly.glb` 를 생성·덮어쓰지 않는다.
 *   승인 전 모든 산출물은 후보 경로 `.out/candidates/<candidateId>/` 안에만 둔다.
 *
 * 빌더(build-rider-candidate.mjs)·렌더러(render-views.mjs)·승격(promote-candidate.mjs)이
 * 이 모듈을 공유해 candidateId·해시·경로 규칙을 단일화한다.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** apps/web 루트 */
export const WEB_ROOT = path.join(__dirname, "..", "..");

/** 제품 GLB(앱이 로드) — 승인 전 금지 대상 */
export const PRODUCTION_GLB = path.join(WEB_ROOT, "public", "rider", "prototype", "rider-lowpoly.glb");
/** 후보 루트 */
export const CANDIDATES_ROOT = path.join(WEB_ROOT, "scripts", "rider-preview", ".out", "candidates");

/**
 * source hash 대상 — rig·IK·pose·viewer·renderer 까지 포함(사용자 지시).
 * 존재하는 파일만 사용(단계별로 아직 없는 파일 skip). 경로+내용을 함께 해시.
 */
export const SOURCE_FILES = [
  "src/lib/riderPrototype/riderAnthropometry.json",
  "src/lib/riderPrototype/riderBody.mjs",
  "src/lib/riderPrototype/riderRig.geometry.mjs",
  "src/lib/riderPrototype/riderIk.mjs",
  "src/lib/riderGlbPedalPose.pose.mjs",
  "scripts/generate-rider-prototype-glb.mjs",
  "scripts/build-rider-candidate.mjs",
  "scripts/rider-preview/rider-viewer.html",
  "scripts/rider-preview/render-views.mjs",
];

/**
 * source hash — 대상 파일들을 **경로 정렬** 후 (경로 문자열 + 내용)을 결합해 SHA-256.
 * 동일 내용이라도 파일 구성(경로)이 달라지면 다른 해시가 된다(사용자 지시).
 * @returns {{ full:string, short:string, files:string[] }}
 */
export function computeSourceHash() {
  const present = SOURCE_FILES.filter((f) => fs.existsSync(path.join(WEB_ROOT, f))).sort();
  const h = crypto.createHash("sha256");
  for (const rel of present) {
    h.update(rel, "utf8"); // 경로 문자열
    h.update("\0");
    h.update(fs.readFileSync(path.join(WEB_ROOT, rel))); // 내용
    h.update("\0");
  }
  const full = h.digest("hex");
  return { full, short: full.slice(0, 8), files: present };
}

/** 파일 SHA-256 (전체) */
export function fileSha256(absPath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

/** KST(UTC+9) 시각 포맷 — candidateId·메타 표시용 */
export function kstNow() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  const yyyy = kst.getUTCFullYear();
  const MM = p(kst.getUTCMonth() + 1), dd = p(kst.getUTCDate());
  const HH = p(kst.getUTCHours()), mm = p(kst.getUTCMinutes()), ss = p(kst.getUTCSeconds());
  return {
    compact: `${yyyy}${MM}${dd}-${HH}${mm}${ss}`, // candidateId 용
    human: `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss} KST`, // 메타 표시용
  };
}

/**
 * candidateId 생성 — `YYYYMMDD-HHmmss-<shortSourceHash>` (KST). 매 호출 고유.
 * @returns {{ candidateId, sourceHash, renderedHuman, dir }}
 */
export function newCandidate() {
  const { short, full } = computeSourceHash();
  const t = kstNow();
  const candidateId = `${t.compact}-${short}`;
  const dir = path.join(CANDIDATES_ROOT, candidateId);
  fs.mkdirSync(dir, { recursive: true });
  return { candidateId, sourceHash: short, sourceHashFull: full, renderedHuman: t.human, dir };
}

/** 후보 디렉토리 경로 */
export function candidateDir(candidateId) {
  return path.join(CANDIDATES_ROOT, candidateId);
}

/** 후보 산출물 파일명 규칙 — 모든 파일명에 candidateId 삽입 */
export function candidateFile(candidateId, kind, ext) {
  return path.join(candidateDir(candidateId), `${kind}-${candidateId}.${ext}`);
}

/** 후보 메타 기록/읽기 */
export function writeCandidateMeta(candidateId, meta) {
  fs.writeFileSync(
    path.join(candidateDir(candidateId), "candidate-meta.json"),
    JSON.stringify(meta, null, 2),
  );
}
export function readCandidateMeta(candidateId) {
  return JSON.parse(fs.readFileSync(path.join(candidateDir(candidateId), "candidate-meta.json"), "utf8"));
}

/**
 * 이미지 오버레이용 메타 문자열 세트. viewer 가 이걸 화면 모서리에 그린다.
 * @param stage RIDER_ONLY | BIKE_FIT | PEDAL
 */
export function overlayMeta({ candidateId, sourceHash, renderedHuman, glbHash, stage, status = "UNAPPROVED" }) {
  return {
    candidate: candidateId,
    rendered: renderedHuman,
    source: sourceHash,
    glb: (glbHash ?? "").slice(0, 8),
    stage,
    status,
  };
}
