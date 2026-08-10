/**
 * S3-DIAG §3 — fixture · known-fail · 스케일 게이트
 *
 *   cd apps/web && node scripts/peer-sync/s3-fixture-gate.mjs
 *
 * ⚠ 무효 로그에서 새 D_eff 숫자를 REPORT 에 올리지 않는다.
 *    depart·cruise 는 「D_eff 산출 불가」만 표시.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parsePeerSyncLine,
  computeDeffResidualFromSeries,
  computeScaleGate,
  overlapAtDelay,
  judgeCase,
  S1_LIMITS,
} from "./s1-metrics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(HERE, "../../../../document/ops/sync-relay/REPORT-S1-raw-logs.json");
const SCENARIO = resolve(HERE, "../../../../document/ops/sync-relay/s2-z15-cruise-scenario.json");
const OUT = resolve(HERE, "../../../../document/ops/sync-relay/S3-fixture-gate.json");

const INVALID_OLD_D = {
  "z15-depart": 10_000,
  "z15-cruise": 7_140,
};

function seriesFromLogs(linesA, linesB, t0, t1) {
  const aSelf = [];
  for (const line of linesA) {
    const p = parsePeerSyncLine(line);
    if (!p) continue;
    if (p.t < t0 || p.t > t1) continue;
    aSelf.push({ t: p.t, self: p.self });
  }
  const bPeer = [];
  for (const line of linesB) {
    const p = parsePeerSyncLine(line);
    if (!p?.peers?.[0]) continue;
    if (p.t < t0 || p.t > t1) continue;
    const peer = p.peers[0];
    bPeer.push({
      t: p.t,
      newest: peer.newest,
      disp: peer.disp,
      age: peer.age,
      buf: peer.buf,
      spd: peer.spd,
    });
  }
  return { aSelf, bPeer };
}

function consecutiveDuplicateDistRatio(events) {
  if (events.length < 2) return { dup: 0, n: 0, ratio: 0 };
  let dup = 0;
  for (let i = 1; i < events.length; i += 1) {
    if (Math.abs(events[i].packet.distM - events[i - 1].packet.distM) <= 0.05) dup += 1;
  }
  const n = events.length - 1;
  return { dup, n, ratio: n > 0 ? dup / n : 0 };
}

/** 첫 windowSec 동안 실제 진행속도 vs 발행 speedMps 중앙값 */
function targetVsApplied(events, windowSec = 6) {
  if (events.length < 2) return null;
  const t0 = events[0].atMs;
  const t1 = t0 + windowSec * 1000;
  const inWin = events.filter((e) => e.atMs <= t1);
  if (inWin.length < 2) return null;
  const first = inWin[0];
  const last = inWin[inWin.length - 1];
  const dt = (last.atMs - first.atMs) / 1000;
  if (dt < 1) return null;
  const actualMps = (last.packet.distM - first.packet.distM) / dt;
  const published = inWin.map((e) => e.packet.speedMps).filter((v) => v > 0.02);
  published.sort((a, b) => a - b);
  const pubMed = published[Math.floor(published.length / 2)] ?? 0;
  const rel = pubMed > 0 ? Math.abs(actualMps - pubMed) / pubMed : Infinity;
  return { actualMps, publishedMps: pubMed, rel, windowSec };
}

const raw = JSON.parse(readFileSync(RAW, "utf8"));
const skew = raw.skewBefore ?? 0;
const failures = [];
const fixtures = [];

for (const c of raw.reportCases.filter((x) => String(x.id).startsWith("z15-"))) {
  const al = c.metrics?.aligned;
  if (!al?.length) {
    failures.push(`${c.id}: no aligned`);
    continue;
  }
  const t0 = al[0].t;
  const t1 = al[al.length - 1].t;
  // §2 검증: 창만 사용(패딩 없음) — 경계 클램프 없이 옛 D_eff 겹침이 무너져야 함
  const { aSelf, bPeer } = seriesFromLogs(raw.logsA, raw.logsB, t0, t1);
  const scale = computeScaleGate(aSelf, bPeer);
  const id = `s1-${c.id}`;

  if (c.id === "z15-depart" || c.id === "z15-cruise") {
    const oldD = INVALID_OLD_D[c.id];
    const ov = overlapAtDelay(aSelf, bPeer, oldD, { clockSkewMs: skew });
    // 숫자 D_eff 를 산출·기록하지 않음
    const okSection2 = ov.overlap < 0.7;
    if (!okSection2) failures.push(`${id}: §2 미달 — oldD=${oldD} overlap=${ov.overlap.toFixed(3)} ≥ 0.7`);
    fixtures.push({
      id,
      kind: "invalid",
      status: "D_eff 산출 불가",
      scale: { status: scale.status, reason: scale.reason, deltaSelfM: scale.deltaSelfM, deltaNewestM: scale.deltaNewestM },
      section2: { oldClaimedD_ms: oldD, overlapAtOldD: ov.overlap, pass: okSection2 },
      // computeDeff 결과는 참고만 — REPORT 지표표에 올리지 않음
      _computeRefOnly: computeDeffResidualFromSeries(aSelf, bPeer, {
        clockSkewMs: skew,
        maxDelayMs: oldD,
        delayStepMs: 20,
        minOverlapRatio: 0.7,
      }).status,
    });
    continue;
  }

  // decel · pause — 정확도 예산 회귀 + 스케일 유보
  const metrics = computeDeffResidualFromSeries(aSelf, bPeer, {
    clockSkewMs: skew,
    maxDelayMs: 800,
    delayStepMs: 20,
    minOverlapRatio: 0.7,
  });
  const accuracy = judgeCase(metrics);
  const scaleStatus = scale.status === "판정 유보" ? "판정 유보" : scale.status;
  if (scaleStatus !== "판정 유보") {
    failures.push(`${id}: 스케일은 판정 유보여야 함 (got ${scaleStatus})`);
  }
  if (!accuracy.pass) {
    failures.push(`${id}: 정확도 예산 FAIL ${accuracy.fail.join("; ")}`);
  }
  fixtures.push({
    id,
    kind: "accuracy-budget",
    accuracy: {
      pass: accuracy.pass,
      D_eff: metrics.D_eff,
      residualRmse: metrics.residualRmse,
      residualMax: metrics.residualMax,
      limits: S1_LIMITS,
      fail: accuracy.fail,
    },
    scale: { status: "판정 유보", reason: scale.reason, deltaSelfM: scale.deltaSelfM, windowMs: scale.windowMs },
  });
}

// known-fail d0 / d1 — cruise 실로그 시나리오 (현재 동작 단언)
let knownFails = [];
try {
  const scenario = JSON.parse(readFileSync(SCENARIO, "utf8"));
  const d0 = consecutiveDuplicateDistRatio(scenario.events);
  const d0Pass = d0.ratio >= 0.4;
  if (!d0Pass) failures.push(`d0-duplicate-distm: ratio ${d0.ratio} < 0.4 (버그 사라짐 → 기대값 뒤집기)`);
  knownFails.push({
    id: "d0-duplicate-distm",
    kind: "known-fail-assert-current",
    pass: d0Pass,
    ratio: d0.ratio,
    dup: d0.dup,
    n: d0.n,
    expect: "연속 중복 distM ≥ 40%",
  });

  const d1 = targetVsApplied(scenario.events, 6);
  const d1Pass = d1 != null && d1.rel >= 0.2;
  if (!d1Pass) {
    failures.push(
      `d1-target-vs-applied: rel=${d1?.rel} (버그 사라짐 → 기대값 뒤집기)`,
    );
  }
  knownFails.push({
    id: "d1-target-vs-applied",
    kind: "known-fail-assert-current",
    pass: d1Pass,
    ...d1,
    expect: "발행 speedMps 가 실제 진행속도와 ≥ 20% 어긋남",
  });
} catch (e) {
  failures.push(`known-fail: scenario 로드 실패 ${e.message}`);
}

const out = {
  pass: failures.length === 0,
  failures,
  fixtures,
  knownFails,
  generatedAt: new Date().toISOString(),
};
writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(JSON.stringify({ pass: out.pass, failures, fixtureIds: fixtures.map((f) => f.id), knownFails: knownFails.map((k) => ({ id: k.id, pass: k.pass })) }, null, 2));
process.exit(out.pass ? 0 : 1);
