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
const S3B1_EVENTS = resolve(HERE, "../../../../document/ops/sync-relay/S3B1-chain-events.json");
const S3B2_EVENTS = resolve(HERE, "../../../../document/ops/sync-relay/S3B2-chain-events.json");
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

// d0 — S3B-1 에서 기대값 뒤집음: 연속 중복 < 40% (살아 있는 발행 스트림)
// d1 — S3B-2 에서 기대값 뒤집음: 발행 speed vs 실제 진행 < 20% (S3B2-chain)
let knownFails = [];
try {
  try {
    const b1 = JSON.parse(readFileSync(S3B1_EVENTS, "utf8"));
    const pub = b1.publisherUid;
    const pts = [];
    for (const e of b1.events ?? []) {
      if (e.side !== "A" || e.pt !== 3) continue;
      if (pub && e.uid && e.uid !== pub) continue;
      const distM = Number(e.d);
      if (!Number.isFinite(distM)) continue;
      pts.push({ packet: { distM } });
    }
    const d0 = consecutiveDuplicateDistRatio(pts);
    const d0Pass = d0.ratio < 0.4;
    if (!d0Pass) failures.push(`d0-duplicate-distm: ratio ${d0.ratio} ≥ 0.4 (D-0 제거 후 뒤집힌 기대 미달)`);
    knownFails.push({
      id: "d0-duplicate-distm",
      kind: "flipped-after-S3B-1",
      pass: d0Pass,
      ratio: d0.ratio,
      dup: d0.dup,
      n: d0.n,
      expect: "연속 중복 distM < 40% (구 expect ≥40% 를 뒤집음)",
      source: "S3B1-chain-events.json pt3",
    });
  } catch (e) {
    failures.push(`d0-duplicate-distm: S3B1-chain-events.json 없음 (${e.message})`);
  }

  try {
    const s3b2 = JSON.parse(readFileSync(S3B2_EVENTS, "utf8"));
    const pub = s3b2.publisherUid;
    const a = (s3b2.events ?? []).filter(
      (e) => e.side === "A" && e.pt === 3 && (!pub || !e.uid || e.uid === pub),
    );
    const mark = s3b2.cases?.["z15-depart"];
    const t0 = (mark?.start?.a ?? 0) + 2_000;
    const t1 = t0 + 6_000;
    const inWin = a
      .map((e) => ({
        atMs: Number(e.writeStart ?? e.capturedAt),
        distM: Number(e.d),
        speedMps: Number(e.v),
      }))
      .filter(
        (e) =>
          Number.isFinite(e.atMs) &&
          Number.isFinite(e.distM) &&
          e.atMs >= t0 &&
          e.atMs <= t1,
      )
      .sort((x, y) => x.atMs - y.atMs);
    let d1 = null;
    if (inWin.length >= 2) {
      const first = inWin[0];
      const last = inWin[inWin.length - 1];
      const dt = (last.atMs - first.atMs) / 1000;
      if (dt >= 1) {
        const actualMps = (last.distM - first.distM) / dt;
        const published = inWin.map((e) => e.speedMps).filter((v) => v > 0.02);
        published.sort((x, y) => x - y);
        const pubMed = published[Math.floor(published.length / 2)] ?? 0;
        const rel = pubMed > 0 ? Math.abs(actualMps - pubMed) / pubMed : Infinity;
        d1 = { actualMps, publishedMps: pubMed, rel, windowSec: 6 };
      }
    }
    const d1Pass = d1 != null && d1.rel < 0.2;
    if (!d1Pass) {
      failures.push(`d1-target-vs-applied: rel=${d1?.rel} (D-1 후 <20% 기대 미달)`);
    }
    knownFails.push({
      id: "d1-target-vs-applied",
      kind: "flipped-after-S3B-2",
      pass: d1Pass,
      ...d1,
      expect: "발행 speedMps 가 실제 진행속도와 < 20% 어긋남 (구 ≥20% 를 뒤집음)",
      source: "S3B2-chain-events.json pt3",
    });
  } catch (e) {
    failures.push(`d1-target-vs-applied: S3B2-chain-events.json 없음 (${e.message})`);
  }
} catch (e) {
  failures.push(`known-fail: ${e.message}`);
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
