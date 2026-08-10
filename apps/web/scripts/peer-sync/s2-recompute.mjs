/**
 * S2 §1-0 — REPORT-S1-raw-logs.json 재계산 (앱·브라우저 불필요)
 *
 *   cd apps/web && node scripts/peer-sync/s2-recompute.mjs
 *
 * z13 은 합성 → 지표 제외. z15 만 maxDelayMs 5000→10000 탐색.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parsePeerSyncLine,
  computeDeffResidualFromSeries,
  judgeCase,
} from "./s1-metrics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(HERE, "../../../../document/ops/sync-relay/REPORT-S1-raw-logs.json");
const OUT = resolve(HERE, "../../../../document/ops/sync-relay/S2-recompute.json");

function selfSeries(lines) {
  const rows = [];
  for (const line of lines) {
    const p = parsePeerSyncLine(line);
    if (p) rows.push({ t: p.t, self: p.self });
  }
  return rows;
}

function peerSeries(lines) {
  const rows = [];
  for (const line of lines) {
    const p = parsePeerSyncLine(line);
    if (!p?.peers?.[0]) continue;
    const peer = p.peers[0];
    rows.push({
      t: p.t,
      newest: peer.newest,
      disp: peer.disp,
      age: peer.age,
      buf: peer.buf,
      spd: peer.spd,
    });
  }
  return rows;
}

function bFromAligned(aligned) {
  return aligned.map((r) => ({
    t: r.t,
    newest: r.newest,
    disp: r.disp,
    age: r.age,
    buf: r.buf,
    spd: r.spd,
  }));
}

function recomputeCase(aAll, caseRow, skew, maxDelayMs) {
  const al = caseRow.metrics.aligned;
  const t0 = al[0].t;
  const t1 = al[al.length - 1].t;
  const a = aAll.filter((r) => r.t >= t0 - maxDelayMs - 2000 && r.t <= t1);
  const b = bFromAligned(al);
  const m = computeDeffResidualFromSeries(a, b, {
    clockSkewMs: skew,
    maxDelayMs,
    delayStepMs: 20,
  });
  return {
    ...m,
    windowMs: t1 - t0,
    hitCeiling: m.D_eff === maxDelayMs,
    aN: a.length,
    bN: b.length,
  };
}

const raw = JSON.parse(readFileSync(RAW, "utf8"));
const aAll = selfSeries(raw.logsA);
const skew = raw.skewBefore ?? 0;

const z15 = raw.reportCases.filter((c) => c.id.startsWith("z15-"));
const z13 = raw.reportCases.filter((c) => c.id.startsWith("z13-"));

const results = {
  skewBefore: skew,
  skewAfter: raw.skewAfter,
  parsedSelfN: aAll.length,
  rebuttal: null,
  z15: [],
  z13: z13.map((c) => ({
    id: c.id,
    status: "측정 불가(합성)",
    note: c.note,
    originalN: c.metrics.n,
    reason:
      "extrapolateSpectator() 5km/h 등차 합성 — 관측 residual/D_eff 인용 금지",
  })),
};

let stayedNear800At5k = true;
for (const c of z15) {
  const at5 = recomputeCase(aAll, c, skew, 5_000);
  const at10 = recomputeCase(aAll, c, skew, 10_000);
  if (Math.abs(at5.D_eff - 800) > 200) stayedNear800At5k = false;
  const pick = at5.hitCeiling ? at10 : at5;
  const judge = judgeCase(pick);
  results.z15.push({
    id: c.id,
    original: {
      D_eff: c.metrics.D_eff,
      residualRmse: c.metrics.residualRmse,
      residualMax: c.metrics.residualMax,
      n: c.metrics.n,
    },
    at5000: {
      D_eff: at5.D_eff,
      residualRmse: at5.residualRmse,
      residualP95: at5.residualP95,
      residualMax: at5.residualMax,
      n: at5.n,
      hitCeiling: at5.hitCeiling,
    },
    at10000: {
      D_eff: at10.D_eff,
      residualRmse: at10.residualRmse,
      residualP95: at10.residualP95,
      residualMax: at10.residualMax,
      n: at10.n,
      hitCeiling: at10.hitCeiling,
    },
    /** §1-0 확정값: 5k에서 천장 아니면 5k, 아니면 10k 결과 */
    confirmed: {
      D_eff: pick.D_eff,
      residualRmse: pick.residualRmse,
      residualP95: pick.residualP95,
      residualMax: pick.residualMax,
      n: pick.n,
      hitCeiling: pick.hitCeiling,
      searchMaxMs: at5.hitCeiling ? 10_000 : 5_000,
    },
    judge,
  });
}

results.rebuttal = {
  claim:
    "상한을 5,000 으로 올렸는데도 D_eff 가 800 근처에 머물면 §0-2 진단이 틀린 것이다",
  stayedNear800At5k,
  verdict: stayedNear800At5k
    ? "반증 성립 → §0-2 틀림. 즉시 보고"
    : "반증 불성립 → §0-2 유지(800은 탐색 상한 히트). 확정값 채택",
};

writeFileSync(OUT, JSON.stringify(results, null, 2), "utf8");

console.log("=== S2 §1-0 재계산 ===");
console.log("반증:", results.rebuttal.verdict);
for (const r of results.z15) {
  const c = r.confirmed;
  console.log(
    `${r.id}: D_eff=${c.D_eff}ms RMSE=${c.residualRmse?.toFixed(3)} max=${c.residualMax?.toFixed(3)} n=${c.n} ceiling=${c.hitCeiling} searchMax=${c.searchMaxMs} ${r.judge.pass ? "PASS" : "FAIL"}`,
  );
}
console.log("wrote", OUT);
