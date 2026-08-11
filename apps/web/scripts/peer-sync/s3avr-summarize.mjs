/**
 * S3A-VR — S3AV-chain-events.json + S3AV-summary 창 → S3AVR-summary.json
 * skew = 0 (동일 머신 OS 시계). 새 e2e 없음. 판정 예산 변경 없음.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeDeffResidualFromSeries, S1_LIMITS } from "./s1-metrics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../../../../document/ops/sync-relay");
const EVENTS = resolve(DIR, process.argv[2] || "S3AV-chain-events.json");
const OUT = resolve(DIR, process.argv[3] || "S3AVR-summary.json");
const PRIOR = resolve(DIR, "S3AV-summary.json");

const INTERP_DELAY_MS = 160;
const MAX_DELAY_MS = 3_000;
const MIN_OVERLAP = 0.7;

const TARGET = {
  "z15-depart": { D_eff: 560, residualRmse: 0.639, residualMax: 2.117, overlap: 1 },
  "z15-cruise": { D_eff: 540, residualRmse: 0.751, residualMax: 2.746, overlap: 1 },
};
const CHAIN_TARGET = {
  "z15-depart": { s1: 231, s2: 7, s3: 155, s4: 160, sum: 553, D_eff: 560 },
  "z15-cruise": { s1: 217, s2: 3, s3: 151, s4: 160, sum: 531, D_eff: 540 },
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function stats(arr) {
  const a = arr.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return { n: 0, p50: null, p95: null, max: null };
  const at = (p) => a[Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1))];
  return { n: a.length, p50: at(0.5), p95: at(0.95), max: a[a.length - 1] };
}

function withinPct(got, exp, pct = 0.05) {
  if (got == null || exp == null || !Number.isFinite(got) || !Number.isFinite(exp)) return false;
  if (exp === 0) return Math.abs(got) <= 1e-9;
  return Math.abs(got - exp) / Math.abs(exp) <= pct;
}

const raw = JSON.parse(readFileSync(EVENTS, "utf8"));
const prior = JSON.parse(readFileSync(PRIOR, "utf8"));
const events = raw.events ?? [];
const publisherUid = raw.publisherUid;
const a = events.filter((e) => e.side === "A");
const b = events.filter((e) => e.side === "B");

function uidOk(e, uid = publisherUid) {
  if (!uid || !e.uid) return true;
  return e.uid === uid;
}

function authRows(from, to) {
  const rows = [];
  for (const e of a.filter((x) => x.pt === 1)) {
    const t = num(e.capturedAt);
    const self = num(e.authDist);
    if (t == null || self == null) continue;
    if (from != null && t < from) continue;
    if (to != null && t > to) continue;
    rows.push({
      t,
      self,
      snapshotDist: num(e.snapshotDist),
      appliedKmh: num(e.appliedKmh),
    });
  }
  rows.sort((x, y) => x.t - y.t);
  return rows;
}

function dispRows(from, to) {
  const rows = [];
  for (const e of b.filter((x) => x.pt === 6 && uidOk(x))) {
    const render = num(e.renderTime);
    if (render == null) continue;
    const t = render + INTERP_DELAY_MS;
    if (from != null && t < from) continue;
    if (to != null && t > to) continue;
    const disp = num(e.displayDistM);
    if (disp == null) continue;
    rows.push({
      t,
      disp,
      newest: num(e.newestDist) ?? num(e.s1Dist) ?? disp,
      age: num(e.newestAgeMs) ?? 0,
      buf: num(e.buf) ?? 0,
      spd: num(e.entitySpeedMps) ?? 0,
    });
  }
  rows.sort((x, y) => x.t - y.t);
  return rows;
}

function speedMpsAt(auth, t) {
  if (!auth.length) return null;
  let best = auth[0];
  for (const r of auth) {
    if (r.t <= t) best = r;
    else break;
  }
  const kmh = best.appliedKmh;
  if (kmh == null || kmh <= 0.1) return null;
  return kmh / 3.6;
}

function stage1(authWin) {
  const ms = [];
  const meters = [];
  for (const r of authWin) {
    if (r.snapshotDist == null || r.appliedKmh == null || r.appliedKmh <= 0.1) continue;
    const v = r.appliedKmh / 3.6;
    const gap = r.self - r.snapshotDist;
    ms.push((gap / v) * 1000);
    meters.push(gap);
  }
  return { ms: stats(ms), m: stats(meters) };
}

function stage2(fromA, toA) {
  const ms = [];
  for (const e of a.filter((x) => x.pt === 3)) {
    const t = num(e.writeStart) ?? num(e.capturedAt);
    const q = num(e.publishQueueMs);
    if (t == null || q == null) continue;
    if (t < fromA || t > toA) continue;
    ms.push(q);
  }
  return { ms: stats(ms) };
}

function firstPt4BySeq(side, pubUid) {
  const map = new Map();
  for (const e of events.filter((x) => x.side === side && x.pt === 4 && num(x.first) === 1 && uidOk(x, pubUid))) {
    if (e.seq == null) continue;
    if (!map.has(e.seq)) map.set(e.seq, e);
  }
  return map;
}

function stage3(fromWrite, toWrite, sendSide, recvSide, sendUid) {
  const recv = firstPt4BySeq(recvSide, sendUid);
  const src = events.filter((x) => x.side === sendSide && x.pt === 3);
  const ms = [];
  const ack = [];
  const rtt = [];
  for (const e of src) {
    if (sendUid && e.uid && e.uid !== sendUid) continue;
    const ws = num(e.writeStart);
    const wd = num(e.writeDone);
    const wr = num(e.writeRttMs);
    if (ws == null) continue;
    if (ws < fromWrite || ws > toWrite) continue;
    const p4 = recv.get(e.seq);
    const seen = num(p4?.firstSeenAt) ?? num(p4?.recvAt);
    if (seen == null) continue;
    ms.push(seen - ws);
    if (wd != null) ack.push(seen - wd);
    if (wr != null) rtt.push(wr);
  }
  return { ms: stats(ms), receiveVsAckMs: stats(ack), writeRttMs: stats(rtt), nMatch: ms.length };
}

function withM(msStats, vMps) {
  const toM = (ms) => (ms == null || vMps == null ? null : (vMps * ms) / 1000);
  return { ...msStats, speedMpsUsed: vMps, p50_m: toM(msStats.p50), p95_m: toM(msStats.p95) };
}

function judgeCase(id) {
  const win = prior.cases?.[id]?.window;
  if (!win) return { id, missing: true };
  const a0 = win.a0;
  const a1 = win.a1;
  const b0 = win.b0;
  const b1 = win.b1;

  const authPad = authRows(a0 - MAX_DELAY_MS, a1);
  const authWin = authRows(a0, a1);
  const disp = dispRows(b0, b1);

  const deff = computeDeffResidualFromSeries(authPad, disp, {
    clockSkewMs: 0,
    maxDelayMs: MAX_DELAY_MS,
    delayStepMs: 20,
    minOverlapRatio: MIN_OVERLAP,
  });
  const hitCeiling = deff.D_eff != null && deff.D_eff === MAX_DELAY_MS;
  const midT = authWin.length ? authWin[Math.floor(authWin.length / 2)].t : a0;
  const v = speedMpsAt(authWin, midT);

  const s1 = stage1(authWin);
  const s2 = stage2(a0, a1);
  const s3 = stage3(a0, a1, "A", "B", publisherUid);
  const s4 = { ms: { n: null, p50: INTERP_DELAY_MS, p95: INTERP_DELAY_MS, max: INTERP_DELAY_MS } };
  const sumP50 = [s1.ms.p50, s2.ms.p50, s3.ms.p50, s4.ms.p50].every((x) => x != null)
    ? s1.ms.p50 + s2.ms.p50 + s3.ms.p50 + s4.ms.p50
    : null;

  const accPass =
    deff.D_eff != null &&
    deff.D_eff <= S1_LIMITS.D_eff_ms &&
    deff.residualRmse <= S1_LIMITS.residualRmse_m &&
    deff.residualMax <= S1_LIMITS.residualMax_m;

  const tgt = TARGET[id];
  const reproduce = tgt
    ? {
        D_eff: { exp: tgt.D_eff, got: deff.D_eff, ok: withinPct(deff.D_eff, tgt.D_eff) },
        RMSE: { exp: tgt.residualRmse, got: deff.residualRmse, ok: withinPct(deff.residualRmse, tgt.residualRmse) },
        max: { exp: tgt.residualMax, got: deff.residualMax, ok: withinPct(deff.residualMax, tgt.residualMax) },
        overlap: { exp: tgt.overlap, got: deff.overlap, ok: withinPct(deff.overlap, tgt.overlap) },
      }
    : null;
  const reproducePass = reproduce && Object.values(reproduce).every((x) => x.ok);

  const chainDelta = sumP50 != null && deff.D_eff != null ? Math.abs(sumP50 - deff.D_eff) : null;
  const chainPass = chainDelta != null && chainDelta <= 50;

  return {
    id,
    window: win,
    skewUsed: 0,
    D_eff: deff.D_eff,
    residualRmse: deff.residualRmse,
    residualMax: deff.residualMax,
    residualP95: deff.residualP95,
    overlap: deff.overlap,
    n: deff.n,
    hitCeiling,
    deffStatus: deff.status,
    verdict: accPass ? "PASS" : "미종결",
    chain: {
      s1_sampleAge: withM(s1.ms, v),
      s1_gapM: s1.m,
      s2_publishQueue: withM(s2.ms, v),
      s3_transport: withM(s3.ms, v),
      s4_interpDelay: withM(s4.ms, v),
      sumP50,
      vsDeff: chainDelta,
      chainPass,
      writeRttMs: s3.writeRttMs,
      receiveVsAckMs: s3.receiveVsAckMs,
      note: "합계=①+②+③+④. writeRtt·receiveVsAck 는 별도 관측(③과 겹침, 합산 제외)",
    },
    reproduce,
    reproducePass,
    chainPass,
    speedMpsUsed: v,
  };
}

const depart = judgeCase("z15-depart");
const cruise = judgeCase("z15-cruise");

const bPublisher =
  events.find((e) => e.side === "B" && e.pt === 3 && e.uid && e.uid !== publisherUid)?.uid ?? null;
const ab = stage3(-Infinity, Infinity, "A", "B", publisherUid);
const ba = stage3(-Infinity, Infinity, "B", "A", bPublisher);

const gate42 =
  depart.reproducePass && cruise.reproducePass
    ? "PASS"
    : "FAIL";
const gate43 = depart.chainPass && cruise.chainPass ? "PASS" : "FAIL";

const out = {
  instruction: "S3A-VR",
  sourceEvents: "S3AV-chain-events.json",
  sourceWindows: "S3AV-summary.json cases.*.window",
  newE2e: false,
  skew: {
    used: 0,
    reason: "Playwright 한 프로세스 · 두 브라우저 컨텍스트 · 동일 머신 OS 시계. skew 존재 여지 없음",
    handshakeObserved: {
      clockSkewBefore: raw.clockSkewBefore,
      clockSkewAfter: raw.clockSkewAfter,
      note: "실행 지연 포함, 판정 미사용",
    },
  },
  gates: {
    reproduce_4_2: gate42,
    chainCross_4_3: gate43,
    budget: S1_LIMITS,
  },
  uag: "z15 스케일 PASS · 정확도 미종결",
  cases: {
    "z15-depart": depart,
    "z15-cruise": cruise,
  },
  transportAsymmetry: {
    A_to_B: ab.ms,
    B_to_A: ba.ms,
    p50_diff: ab.ms.p50 != null && ba.ms.p50 != null ? ab.ms.p50 - ba.ms.p50 : null,
    note: "전송 경로 비대칭 참고값. skew 추정에 쓰지 않음",
  },
  targets: { reproduce: TARGET, chain: CHAIN_TARGET },
};

writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      out: OUT,
      gate42,
      gate43,
      depart: {
        D_eff: depart.D_eff,
        RMSE: depart.residualRmse,
        max: depart.residualMax,
        overlap: depart.overlap,
        sum: depart.chain?.sumP50,
        reproducePass: depart.reproducePass,
        chainPass: depart.chainPass,
      },
      cruise: {
        D_eff: cruise.D_eff,
        RMSE: cruise.residualRmse,
        max: cruise.residualMax,
        overlap: cruise.overlap,
        sum: cruise.chain?.sumP50,
        reproducePass: cruise.reproducePass,
        chainPass: cruise.chainPass,
      },
      asym: { AB: ab.ms.p50, BA: ba.ms.p50, diff: out.transportAsymmetry.p50_diff },
    },
    null,
    2,
  ),
);
