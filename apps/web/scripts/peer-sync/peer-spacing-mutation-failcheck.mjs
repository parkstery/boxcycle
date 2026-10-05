/**
 * peer-spacing 게이트가 「살아 있는지」 증명하는 변이(mutation) 시험.
 *
 * 게이트(`peer-spacing-jitter-harness.mjs --gate`)는 통과만 보면 죽은 게이트와 구분이 안 된다.
 * 이 스크립트는 `stampDualSourceIngestPacket` 만 **수정 전 버그 동작**(내용이 바뀔 때마다
 * `serverAtMs = nowMs` — 도착축 stamp)으로 잠깐 바꿔 끼우고 게이트가 실제로 FAIL(exit≠0)하는지 본다.
 * 끝나면 (크래시·Ctrl-C 포함) 그 함수만 백업에서 복원하고, 같은 하네스·같은 fixture 로 POST 를 한 번 더 돈다.
 *
 *   cd apps/web && node scripts/peer-sync/peer-spacing-mutation-failcheck.mjs
 *   cd apps/web && node scripts/peer-sync/peer-spacing-mutation-failcheck.mjs \
 *       --write-pre-out <path> --write-post-out <path>
 *
 * exit 0 : 변이로 게이트가 FAIL 했고, 복원에 성공했고, 복원 후 POST 게이트가 PASS
 * exit 1 : 변이에도 게이트가 PASS(죽은 게이트) · 하네스 크래시 · 복원 실패 · POST FAIL
 *
 * ⚠️ 파괴적이다(프로덕션 소스를 잠깐 바꾼다) — pre-push 에 넣지 말 것. 다른 파일은 건드리지 않는다.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const OUT_DIR = resolve(HERE, ".out");
const OPS_DIR = resolve(WEB_ROOT, "../../document/ops/20261005-peer-spacing-jitter");
const TARGET = resolve(WEB_ROOT, "src/lib/peerMotion/syncFromPresence.ts");
const HARNESS = resolve(HERE, "peer-spacing-jitter-harness.mjs");
/** 크래시 후 다음 실행이 복구할 수 있도록 고정 경로 */
const BACKUP = join(tmpdir(), "rtw-stampDualSourceIngestPacket.backup.txt");
const MARKER = "PEER-SPACING-MUTATION";
const FN_HEAD = "export function stampDualSourceIngestPacket(";

const MUTANT = `export function stampDualSourceIngestPacket(
  uid: string,
  selected: PeerMotionPacket,
  source: "rtdb" | "fs",
  nowMs: number,
): PeerMotionPacket {
  /* ${MARKER} (temporary) — 수정 전 버그 동작: 내용이 바뀔 때마다 serverAtMs = nowMs(도착축). */
  const fingerprint = \`\${source}|\${selected.serverAtMs}|\${selected.seq ?? ""}|\${selected.distM}|\${selected.speedMps}|\${selected.phase}\`;
  const prev = dualIngestStampByUid.get(uid);
  if (prev && prev.fingerprint === fingerprint) {
    return { ...selected, serverAtMs: prev.normalizedServerAtMs };
  }
  dualIngestStampByUid.set(uid, {
    fingerprint,
    source,
    motionFp: "",
    nativeServerAtMs: selected.serverAtMs,
    offsetMs: 0,
    normalizedServerAtMs: nowMs,
  });
  return { ...selected, serverAtMs: nowMs };
}`;

function parseArgs(argv) {
  const a = {
    preOut: resolve(OPS_DIR, "peer-spacing-jitter-metrics-rework-pre.json"),
    postOut: resolve(OPS_DIR, "peer-spacing-jitter-metrics-rework-post.json"),
    compareOut: resolve(OPS_DIR, "peer-spacing-jitter-metrics-rework-compare.json"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--write-pre-out") a.preOut = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--write-post-out") a.postOut = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--write-compare-out") a.compareOut = resolve(process.cwd(), argv[++i]);
  }
  return a;
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

/** 함수 전체(시그니처+본문) 구간 [start, end) — 중괄호 균형으로 찾는다. */
function locateFunction(src) {
  const start = src.indexOf(FN_HEAD);
  if (start < 0) throw new Error("stampDualSourceIngestPacket 선언을 찾지 못함");
  const sigEnd = src.indexOf("): PeerMotionPacket {", start);
  if (sigEnd < 0) throw new Error("stampDualSourceIngestPacket 시그니처 끝을 찾지 못함");
  const open = sigEnd + "): PeerMotionPacket ".length;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  throw new Error("stampDualSourceIngestPacket 본문 끝을 찾지 못함");
}

/** 현재 파일의 해당 함수만 백업 텍스트로 되돌린다. 동기(시그널 핸들러에서도 사용). */
function restoreFromBackup() {
  if (!existsSync(BACKUP)) return { ok: false, why: "backup 파일 없음" };
  const backupText = readFileSync(BACKUP, "utf8");
  const cur = readFileSync(TARGET, "utf8");
  const { start, end } = locateFunction(cur);
  if (cur.slice(start, end) !== backupText) {
    writeFileSync(TARGET, cur.slice(0, start) + backupText + cur.slice(end), "utf8");
  }
  const after = readFileSync(TARGET, "utf8");
  const loc = locateFunction(after);
  const ok = after.slice(loc.start, loc.end) === backupText && !after.includes(MARKER);
  return { ok, why: ok ? null : "복원 후 함수 본문이 백업과 다르거나 마커가 남아 있음", afterHash: sha(after) };
}

function runHarness(args, label) {
  const r = spawnSync(process.execPath, [HARNESS, ...args], {
    cwd: WEB_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const lines = `${r.stdout ?? ""}${r.stderr ?? ""}`.split(/\r?\n/);
  const show = lines.filter((l) => /^(✓|✗|◇|~|!|GATE|wrote)/.test(l) || /Error/.test(l));
  console.log(`--- ${label}: ${[process.execPath.split(/[\\/]/).pop(), ...args].join(" ")}`);
  for (const l of show) console.log(`  ${l}`);
  console.log(`--- ${label}: exit=${r.status}${r.signal ? ` signal=${r.signal}` : ""}`);
  return r;
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function freshJson(p, sinceMs) {
  if (!existsSync(p)) return null;
  if (statSync(p).mtimeMs < sinceMs) return null;
  return readJson(p);
}

const COMPARE_FIELDS = [
  "minSpeedMps",
  "maxSpeedMps",
  "maxBackM",
  "maxJumpM",
  "reverseFrames",
  "teleportFrames",
  "spacingMinM",
  "spacingMaxM",
  "spacingMeanM",
  "spacingPpM",
  "spacingStdM",
  "pass",
];

function pickCell(report, jitter) {
  return report?.results?.find(
    (r) =>
      r.mode === "dual" &&
      r.intervalMs === 200 &&
      r.senderOffsetMs === 0 &&
      r.jitterPattern === jitter &&
      r.withSeq !== false &&
      !r.note,
  );
}

function buildCompare(pre, post, harnessSha) {
  const out = {
    task: "20261005-peer-spacing-jitter A4 same-fixture PRE/POST",
    at: new Date().toISOString(),
    fixture: {
      harness: "scripts/peer-sync/peer-spacing-jitter-harness.mjs --gate",
      harnessSha256: harnessSha,
      window: "stable (12000..40000ms)",
      cell: "dual × 200ms × senderOffset 0 × withSeq",
      pre: "stampDualSourceIngestPacket = 수정 전 버그 동작(내용 변경마다 serverAtMs=nowMs) — 임시 변이",
      post: "프로덕션 stampDualSourceIngestPacket (복원 후)",
    },
    cells: {},
  };
  for (const jitter of ["sin", "bundle"]) {
    const a = pickCell(pre, jitter)?.stable;
    const b = pickCell(post, jitter)?.stable;
    out.cells[`dual200-${jitter}-off0`] = {
      pre: a ? Object.fromEntries(COMPARE_FIELDS.map((f) => [f, a[f]])) : null,
      post: b ? Object.fromEntries(COMPARE_FIELDS.map((f) => [f, b[f]])) : null,
    };
  }
  return out;
}

function printCompare(cmp) {
  console.log("\n=== PRE vs POST — dual 200ms · off=0 · stable(12–40s) · 같은 하네스/fixture ===");
  for (const [name, c] of Object.entries(cmp.cells)) {
    console.log(`[${name}]`);
    for (const f of COMPARE_FIELDS) {
      const a = c.pre?.[f];
      const b = c.post?.[f];
      console.log(`  ${f.padEnd(15)} PRE=${String(a).padEnd(10)} POST=${b}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(args.preOut), { recursive: true });
  mkdirSync(dirname(args.postOut), { recursive: true });
  const problems = [];

  // 이전 실행이 크래시했다면 먼저 복구한다.
  if (existsSync(BACKUP)) {
    const cur = readFileSync(TARGET, "utf8");
    if (cur.includes(MARKER)) {
      console.log("[recover] 이전 변이가 남아 있음 — 백업에서 복원");
      const r = restoreFromBackup();
      if (!r.ok) {
        console.error(`[recover] 복원 실패: ${r.why}`);
        process.exit(1);
      }
    }
    unlinkSync(BACKUP);
  }

  const original = readFileSync(TARGET, "utf8");
  if (original.includes(MARKER)) {
    console.error("대상 파일에 변이 마커가 있으나 백업이 없음 — 수동 확인 필요");
    process.exit(1);
  }
  const originalHash = sha(original);
  const harnessSha = sha(readFileSync(HARNESS, "utf8"));
  const loc = locateFunction(original);
  const originalFn = original.slice(loc.start, loc.end);

  // 1) 백업은 stampDualSourceIngestPacket 한 함수뿐
  writeFileSync(BACKUP, originalFn, "utf8");
  console.log(
    `backup: ${BACKUP} (stampDualSourceIngestPacket ${originalFn.length} chars, file sha256=${originalHash.slice(0, 12)})`,
  );

  let restored = false;
  const emergencyRestore = () => {
    if (restored) return;
    try {
      const r = restoreFromBackup();
      restored = r.ok;
      console.error(r.ok ? "[emergency] 복원 완료" : `[emergency] 복원 실패: ${r.why}`);
    } catch (e) {
      console.error(`[emergency] 복원 예외: ${e?.message || e}`);
    }
  };
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => {
      emergencyRestore();
      process.exit(130);
    });
  }
  process.on("uncaughtException", (e) => {
    console.error(e);
    emergencyRestore();
    process.exit(1);
  });

  let preReport = null;
  let preStatus = null;
  let transitionsUnderMutation = null;
  let restoreResult = { ok: false, why: "not attempted" };
  try {
    // 2) 변이 주입
    writeFileSync(
      TARGET,
      original.slice(0, loc.start) + MUTANT + original.slice(loc.end),
      "utf8",
    );
    console.log("mutation applied: every content change stamps serverAtMs = nowMs (arrival axis)");

    // 3) 같은 게이트를 변이 코드로 — PRE 메트릭
    if (existsSync(args.preOut)) unlinkSync(args.preOut);
    const since = Date.now() - 1_000;
    const pre = runHarness(["--gate", "--out", args.preOut], "PRE (mutated) gate");
    preStatus = pre.status;
    preReport = freshJson(args.preOut, since);

    // 정보용: 전환 시험도 변이에서 죽는지 (필수 판정 아님)
    const t = runHarness(
      ["--suite", "transitions", "--out", resolve(OUT_DIR, "peer-spacing-transitions-mutated.json")],
      "transitions under mutation (info)",
    );
    const tj = readJson(resolve(OUT_DIR, "peer-spacing-transitions-mutated.json"));
    transitionsUnderMutation = { exit: t.status, requiredFailCount: tj?.requiredFailCount ?? null };
  } finally {
    // 4) 무슨 일이 있어도 복원
    try {
      restoreResult = restoreFromBackup();
      restored = restoreResult.ok;
    } catch (e) {
      restoreResult = { ok: false, why: String(e?.message || e) };
    }
    if (restoreResult.ok && existsSync(BACKUP)) unlinkSync(BACKUP);
    console.log(
      restoreResult.ok
        ? `restore: OK (file sha256 ${restoreResult.afterHash === originalHash ? "identical to pre-mutation" : "differs from pre-mutation (function region restored; file changed elsewhere?)"})`
        : `restore: FAILED — ${restoreResult.why} (backup kept at ${BACKUP})`,
    );
  }

  // 5) 변이 판정
  const preFailCount = preReport?.summary?.requiredFailCount ?? null;
  const gateDiedUnderMutation = preStatus !== 0 && preReport != null && (preFailCount ?? 0) > 0;
  if (preStatus === 0) problems.push("변이에도 게이트 exit 0 — 죽은 게이트(회귀를 못 잡음)");
  else if (!gateDiedUnderMutation) {
    problems.push(`게이트가 exit ${preStatus} 이지만 requiredFail 기록이 없음 — 하네스 크래시일 수 있음`);
  }
  if (!restoreResult.ok) problems.push(`복원 실패: ${restoreResult.why}`);

  // 6) 복원 후 POST — 같은 하네스·같은 fixture
  let postStatus = null;
  let postReport = null;
  if (restoreResult.ok) {
    if (existsSync(args.postOut)) unlinkSync(args.postOut);
    const since = Date.now() - 1_000;
    const post = runHarness(["--gate", "--out", args.postOut], "POST (restored) gate");
    postStatus = post.status;
    postReport = freshJson(args.postOut, since);
    if (postStatus !== 0) problems.push(`복원 후 POST 게이트 exit ${postStatus} (깨끗한 코드가 게이트 FAIL)`);
  }

  if (preReport && postReport) {
    const cmp = buildCompare(preReport, postReport, harnessSha);
    cmp.mutationGate = {
      preExit: preStatus,
      preRequiredFailCount: preFailCount,
      postExit: postStatus,
      postRequiredFailCount: postReport?.summary?.requiredFailCount ?? null,
      transitionsUnderMutation,
    };
    writeFileSync(args.compareOut, JSON.stringify(cmp, null, 2), "utf8");
    printCompare(cmp);
    console.log(`wrote ${args.compareOut}`);
  }

  console.log("\n=== MUTATION CHECK ===");
  console.log(`  mutated gate : exit=${preStatus} requiredFail=${preFailCount} (expect non-zero)`);
  console.log(`  restore      : ${restoreResult.ok ? "OK" : "FAILED"}`);
  console.log(`  POST gate    : exit=${postStatus} (expect 0)`);
  if (transitionsUnderMutation) {
    console.log(
      `  transitions under mutation (info): exit=${transitionsUnderMutation.exit} requiredFail=${transitionsUnderMutation.requiredFailCount}`,
    );
  }
  if (problems.length === 0) {
    console.log("MUTATION CHECK: PASS — 게이트가 변이를 잡았고(FAIL), 복원했고, 복원 후 POST 게이트가 PASS");
    process.exit(0);
  }
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("MUTATION CHECK: FAIL");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  // main 이 던져도 파일이 변이 상태로 남지 않게 마지막으로 한 번 더
  try {
    if (existsSync(BACKUP) && readFileSync(TARGET, "utf8").includes(MARKER)) {
      const r = restoreFromBackup();
      console.error(r.ok ? "[final] 복원 완료" : `[final] 복원 실패: ${r.why}`);
    }
  } catch {
    /* ignore */
  }
  process.exit(1);
});
