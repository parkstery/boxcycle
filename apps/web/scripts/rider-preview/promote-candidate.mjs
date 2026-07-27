/**
 * Promote Candidate — 사용자 승인된 후보 GLB 를 제품 경로로 **확정**(byte-for-byte 복사).
 *
 * ⚠ 사용자 지시(2026-07-25): 승인 후 제품 GLB 를 **다시 생성하지 않는다**. 사용자가 본 프리뷰의
 *   입력이었던 후보 GLB 파일을 제품 경로로 그대로 복사하고, 복사 전후 SHA-256 이 반드시 동일해야
 *   한다. 해시가 다르면 제품 확정 실패로 처리하고 commit 하지 않는다.
 *
 * 사용:
 *   node scripts/rider-preview/promote-candidate.mjs <candidateId>            # 실제 확정(복사)
 *   node scripts/rider-preview/promote-candidate.mjs <candidateId> --dry-run  # 검증만(복사 안 함)
 *
 *   승인 게이트: 실제 복사는 사용자가 해당 candidateId·stage 를 명시적으로 승인했다는 전제로만
 *   호출된다(스크립트가 승인을 판단하지 않는다). **승인 전 검사는 반드시 --dry-run** 으로만.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  candidateDir,
  readCandidateMeta,
  fileSha256,
  PRODUCTION_GLB,
} from "./riderCandidate.mjs";

const __filename = fileURLToPath(import.meta.url);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const candidateId = args.find((a) => !a.startsWith("--"));
if (!candidateId) {
  console.error("사용법: node promote-candidate.mjs <candidateId> [--dry-run]");
  process.exit(2);
}

const dir = candidateDir(candidateId);
if (!fs.existsSync(dir)) {
  console.error(`후보 디렉토리 없음: ${dir}`);
  process.exit(1);
}
const meta = readCandidateMeta(candidateId);
const candidateGlb = path.join(dir, meta.glbFile);
if (!fs.existsSync(candidateGlb)) {
  console.error(`후보 GLB 없음: ${candidateGlb}`);
  process.exit(1);
}

// ── 스킬 사본 동기화 검사 자동 포함 — 불일치면 확정/검증 실패 ─────────────
function checkSkillSync() {
  const sync = path.join(path.dirname(__filename), "sync-skill.mjs");
  try {
    execFileSync(process.execPath, [sync, "--check"], { stdio: "pipe" });
    console.log("  ✓ 스킬 사본 동기화 (.claude == .agents)");
    return true;
  } catch (e) {
    console.error("  ✗ 스킬 사본 불일치 — sync-skill.mjs 로 동기화 필요");
    return false;
  }
}

const candidateSha = fileSha256(candidateGlb);
const glbHashMatch = meta.glbHash ? meta.glbHash === candidateSha : null;

console.log("");
console.log(`Candidate: ${candidateId}  (stage=${meta.stage}, status=${meta.status})`);
console.log(`Candidate SHA-256:  ${candidateSha}`);
if (glbHashMatch !== null) console.log(`  meta.glbHash 일치: ${glbHashMatch ? "YES" : "NO — 후보 변조 의심"}`);
const skillOk = checkSkillSync();

if (dryRun) {
  // ── --dry-run: 복사·기록 없이 검증만 (승인 전 검사 전용) ──
  console.log("");
  console.log("[dry-run] 제품 파일 미변경. 아래 조건 충족 시 승인 후 확정 가능:");
  const ready = fs.existsSync(candidateGlb) && (glbHashMatch !== false) && skillOk;
  console.log(`  후보 GLB 존재: YES`);
  console.log(`  glbHash 정합: ${glbHashMatch === false ? "NO" : "YES"}`);
  console.log(`  스킬 동기화: ${skillOk ? "YES" : "NO"}`);
  console.log(`  Status=UNAPPROVED (승인 대기): ${meta.status === "UNAPPROVED" ? "YES" : `아님(${meta.status})`}`);
  console.log(`\nDry-run 결과: ${ready ? "확정 준비됨(사용자 승인 후 --dry-run 없이 실행)" : "확정 불가 — 위 실패 항목 해결"}`);
  process.exit(ready ? 0 : 1);
}

// ── 실제 확정 (사용자 승인 후에만 호출) ──
if (!skillOk) {
  console.error("\n제품 확정 중단 — 스킬 사본 불일치. 먼저 동기화할 것.");
  process.exit(1);
}
if (glbHashMatch === false) {
  console.error("\n제품 확정 중단 — 후보 GLB 가 빌드시 해시와 다름(변조 의심).");
  process.exit(1);
}

// byte-for-byte 복사 (재생성 아님 — 사용자가 본 그 파일 그대로)
fs.mkdirSync(path.dirname(PRODUCTION_GLB), { recursive: true });
fs.copyFileSync(candidateGlb, PRODUCTION_GLB);
const productionSha = fileSha256(PRODUCTION_GLB);
const match = candidateSha === productionSha;

console.log("");
console.log(`Approved Candidate: ${candidateId}`);
console.log(`Candidate SHA-256:  ${candidateSha}`);
console.log(`Production SHA-256: ${productionSha}`);
console.log(`Match: ${match ? "YES" : "NO"}`);
console.log("");

if (!match) {
  console.error("제품 확정 실패 — 해시 불일치. commit 하지 말 것.");
  process.exit(1);
}

meta.promotedAt = new Date().toISOString();
meta.productionSha256 = productionSha;
meta.candidateSha256 = candidateSha;
meta.status = "APPROVED";
fs.writeFileSync(path.join(dir, "candidate-meta.json"), JSON.stringify(meta, null, 2));
console.log("제품 확정 완료 → public/rider/prototype/rider-lowpoly.glb");
