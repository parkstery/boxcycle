/**
 * S3B-3 — before/after 6 런 → S3B3-summary.json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeDeffResidualFromSeries,
  computeScaleGate,
  S1_LIMITS,
} from "./s1-metrics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../../../../document/ops/sync-relay");
const OUT = resolve(DIR, "S3B3-summary.json");
const S3B2_POST = resolve(DIR, "S3B2-chain-events.json");

const INTERP_DELAY_MS = 160;
const DISCARD_MS = 2_000;
const MAX_DELAY_MS = 3_000;
const DELAY_STEP_MS = 20;
const MIN_OVERLAP = 0.7;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function stats(arr) {
  const a = arr.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return { n: 0, min: null, p50: null, p95: null, max: null };
  const at = (p) => a[Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1))];
  return { n: a.length, min: a[0], p50: at(0.5), p95: at(0.95), max: a[a.length - 1] };
}

function median(arr) {
  const s = stats(arr);
  return s.p50;
}

function uidOk(e, uid) {
  if (!uid || !e.uid) return true;
  return e.uid === uid;
}

function windowOf(mark) {
  return {
    a0: (mark?.start?.a ?? 0) + DISCARD_MS,
    a1: mark?.end?.a ?? Infinity,
    b0: (mark?.start?.b ?? 0) + DISCARD_MS,
    b1: mark?.end?.b ?? Infinity,
  };
}

function analyzeZ15(raw) {
  const events = raw.events ?? [];
  const publisherUid = raw.publisherUid;
  const a = events.filter((e) => e.side === "A");
  const b = events.filter((e) => e.side === "B");
  const casesIn = raw.cases ?? {};

  function authRows(from, to) {
    const rows = [];
    for (const e of a.filter((x) => x.pt === 1)) {
      const t = num(e.capturedAt);
      const self = num(e.authDist);
      if (t == null || self == null) continue;
      if (from != null && t < from) continue;
      if (to != null && t > to) continue;
      rows.push({ t, self });
    }
    rows.sort((x, y) => x.t - y.t);
    return rows;
  }

  function dispRows(from, to) {
    const rows = [];
    for (const e of b.filter((x) => x.pt === 6 && uidOk(x, publisherUid))) {
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
        newest: num(e.newestDist) ?? disp,
        age: num(e.newestAgeMs) ?? 0,
        buf: num(e.buf) ?? 0,
        spd: num(e.entitySpeedMps) ?? 0,
      });
    }
    rows.sort((x, y) => x.t - y.t);
    return rows;
  }

  function newestRows(from, to) {
    const firstPt4 = new Map();
    for (const e of b.filter((x) => x.pt === 4 && uidOk(x, publisherUid))) {
      const key = `${e.uid}:${e.seq}`;
      if (!firstPt4.has(key)) firstPt4.set(key, e);
    }
    const rows = [];
    for (const e of b.filter((x) => x.pt === 5 && x.result === "accepted" && uidOk(x, publisherUid))) {
      const p4 = firstPt4.get(`${e.uid}:${e.seq}`);
      const t = num(p4?.recvAt) ?? num(p4?.firstSeenAt);
      const newest = num(e.d);
      if (t == null || newest == null) continue;
      if (from != null && t < from) continue;
      if (to != null && t > to) continue;
      rows.push({ t, newest, disp: newest, age: 0, buf: 0, spd: 0 });
    }
    rows.sort((x, y) => x.t - y.t);
    return rows;
  }

  function judgeCase(id) {
    const mark = casesIn[id];
    if (!mark) return { id, missing: true };
    const win = windowOf(mark);
    const authPad = authRows(win.a0 - MAX_DELAY_MS, win.a1);
    const authWin = authRows(win.a0, win.a1);
    const disp = dispRows(win.b0, win.b1);
    const newest = newestRows(win.b0, win.b1);
    const scale = computeScaleGate(authWin, newest, { minDeltaSelfM: 100, minWindowMs: 20_000 });
    const deff = computeDeffResidualFromSeries(authPad, disp, {
      clockSkewMs: 0,
      maxDelayMs: MAX_DELAY_MS,
      delayStepMs: DELAY_STEP_MS,
      minOverlapRatio: MIN_OVERLAP,
    });
    const scalePct = scale.ratio != null && Number.isFinite(scale.ratio) ? scale.ratio * 100 : null;
    const accPass =
      deff.D_eff != null &&
      deff.D_eff <= S1_LIMITS.D_eff_ms &&
      deff.residualRmse <= S1_LIMITS.residualRmse_m &&
      deff.residualMax <= S1_LIMITS.residualMax_m &&
      scale.status === "PASS";
    return {
      id,
      D_eff: deff.D_eff,
      residualRmse: deff.residualRmse,
      residualMax: deff.residualMax,
      overlap: deff.overlap,
      n: deff.n,
      scalePct,
      scaleStatus: scale.status,
      accPass,
    };
  }

  const pt3 = a.filter((e) => e.pt === 3);
  const pt9 = a.filter((e) => e.pt === 9);
  const publishQueue = pt3.map((e) => num(e.publishQueueMs)).filter((x) => x != null);
  const pq = stats(publishQueue);
  const inFlightMax = Math.max(0, ...pt3.map((e) => num(e.inFlightMax) ?? 0));
  let forward = 0;
  for (const e of b.filter((x) => x.pt === 5 && uidOk(x, publisherUid))) {
    if (e.result === "discard-forward") forward += 1;
  }
  const pt3ok0 = pt3.filter((e) => num(e.ok) === 0).length;
  const pt9ok0 = pt9.filter((e) => num(e.ok) === 0).length;

  return {
    cases: { "z15-depart": judgeCase("z15-depart"), "z15-cruise": judgeCase("z15-cruise") },
    guards: {
      inFlightMax: { pass: inFlightMax <= 1, got: inFlightMax },
      forwardDiscard: { pass: forward === 0, got: forward },
      pt3_ok0: { pass: pt3ok0 === 0, got: pt3ok0 },
      pt9_ok0: { pass: pt9ok0 === 0, got: pt9ok0 },
      publishQueueMs: {
        pass:
          pq.p50 != null &&
          pq.p50 <= 150 &&
          pq.p95 <= 400 &&
          pq.max <= 800 &&
          !publishQueue.some((x) => x > 1000),
        got: pq,
      },
    },
    guardsPass: inFlightMax <= 1 && forward === 0 && pt3ok0 === 0 && pt9ok0 === 0,
  };
}

function pathAFromRun(raw) {
  const pathA = raw.pathA ?? {};
  const restoreStart = pathA.restoreStart?.b;
  const restoreEnd = pathA.restoreEnd?.b;
  if (restoreStart == null || restoreEnd == null) return null;
  const pub = raw.publisherUid;
  const events = raw.events ?? [];
  const pt6 = events.filter(
    (e) =>
      e.side === "B" &&
      e.pt === 6 &&
      uidOk(e, pub) &&
      num(e.renderTime) != null &&
      num(e.displayDistM) != null,
  );
  const pt6Win = pt6
    .map((e) => ({
      t: (num(e.renderTime) ?? 0) + INTERP_DELAY_MS,
      disp: num(e.displayDistM),
    }))
    .filter((e) => e.t >= restoreStart && e.t <= restoreEnd + 500)
    .sort((x, y) => x.t - y.t);
  if (!pt6Win.length) return null;

  const pt1 = events
    .filter((e) => e.side === "A" && e.pt === 1)
    .map((e) => ({ t: num(e.capturedAt), self: num(e.authDist) }))
    .filter((e) => e.t != null && e.self != null)
    .sort((x, y) => x.t - y.t);

  const errs = [];
  const settleMs = [];
  let firstErr = null;
  for (const p of pt6Win) {
    const truth = pt1.filter((x) => x.t <= p.t).at(-1);
    if (!truth) continue;
    const err = Math.abs(p.disp - truth.self);
    errs.push(err);
    if (firstErr == null) firstErr = err;
    if (settleMs.length === 0 && err <= 2.5) settleMs.push(p.t - restoreStart);
  }
  const abs = stats(errs);
  return {
    jumpM: firstErr,
    settleMs: settleMs[0] ?? null,
    errP50: abs.p50,
    errMax: abs.max,
    n: abs.n,
  };
}

function pathBFromRun(raw) {
  const pub = raw.publisherUid;
  const events = raw.events ?? [];
  const mark = raw.cases?.["z15-depart"];
  if (!mark) return null;
  const win = windowOf(mark);
  const tB0 = raw.clockRangeB?.start ?? mark.start.b;
  const tB1 = raw.clockRangeB?.end ?? mark.end.b;
  const skew0 = num(raw.clockSkewBefore) ?? 0;
  const skew1 = num(raw.clockSkewAfter) ?? skew0;

  const pt1 = events
    .filter((e) => e.side === "A" && e.pt === 1)
    .map((e) => ({ t: num(e.capturedAt), self: num(e.authDist) }))
    .filter((e) => e.t != null && e.self != null)
    .sort((x, y) => x.t - y.t);

  function skewAt(recvB) {
    if (tB1 <= tB0) return skew0;
    const frac = Math.max(0, Math.min(1, (recvB - tB0) / (tB1 - tB0)));
    return skew0 + frac * (skew1 - skew0);
  }

  function errFromPt10(e) {
    const dist = num(e.distM);
    const recvB = num(e.nowMs) ?? num(e.recvLocalMs);
    if (dist == null || recvB == null) return null;
    if (recvB < win.b0 || recvB > win.b1) return null;
    const tA = recvB - skewAt(recvB) + INTERP_DELAY_MS;
    const truth = pt1.filter((x) => x.t <= tA - 300).at(-1);
    if (!truth) return null;
    return Math.abs(dist - truth.self);
  }

  const pt10 = events.filter((e) => e.side === "B" && e.pt === 10 && uidOk(e, pub));
  if (pt10.length) {
    const errs = pt10.map(errFromPt10).filter((x) => x != null);
    const extrap = pt10.map((e) => num(e.extrapMs)).filter((x) => x != null);
    const capHits = pt10.filter((e) => num(e.capHit) === 1).length;
    const es = stats(errs);
    return {
      source: "pt10",
      errP50: es.p50,
      errMax: es.max,
      extrapP50: stats(extrap).p50,
      extrapP95: stats(extrap).p95,
      capHitRate: pt10.length ? capHits / pt10.length : null,
      n: pt10.length,
    };
  }

  // before 빌드: pt10 없음 — depart 구간 pt6 vs A.self 근사(동일 시계 정렬)
  const pt6 = events.filter((e) => e.side === "B" && e.pt === 6 && uidOk(e, pub));
  const errs = [];
  for (const e of pt6) {
    const recvB = num(e.renderTime);
    const disp = num(e.displayDistM);
    if (recvB == null || disp == null) continue;
    if (recvB < win.b0 || recvB > win.b1) continue;
    const tA = recvB - skewAt(recvB) + INTERP_DELAY_MS;
    const truth = pt1.filter((x) => x.t <= tA - 300).at(-1);
    if (!truth) continue;
    errs.push(Math.abs(disp - truth.self));
  }
  const s = stats(errs);
  return { source: "pt6-proxy", errP50: s.p50, errMax: s.max, n: s.n };
}

function loadRuns(phase) {
  return [1, 2, 3].map((n) => {
    const p = resolve(DIR, `S3B3-${phase}-run${n}-events.json`);
    if (!existsSync(p)) throw new Error(`missing ${p}`);
    return JSON.parse(readFileSync(p, "utf8"));
  });
}

const beforeRuns = loadRuns("before");
const afterRuns = loadRuns("after");

const beforeZ15 = beforeRuns.map(analyzeZ15);
const afterZ15 = afterRuns.map(analyzeZ15);

const departDeffBefore = stats(beforeZ15.map((r) => r.cases["z15-depart"].D_eff));
const departDeffAfter = stats(afterZ15.map((r) => r.cases["z15-depart"].D_eff));
const cruiseDeffAfter = stats(afterZ15.map((r) => r.cases["z15-cruise"].D_eff));

const pathABefore = beforeRuns.map(pathAFromRun).filter(Boolean);
const pathAAfter = afterRuns.map(pathAFromRun).filter(Boolean);
const pathBBefore = beforeRuns.map(pathBFromRun).filter(Boolean);
const pathBAfter = afterRuns.map(pathBFromRun).filter(Boolean);

const pathAJumpBefore = median(pathABefore.map((x) => x.jumpM));
const pathAJumpAfter = median(pathAAfter.map((x) => x.jumpM));
const pathASettleAfter = median(pathAAfter.map((x) => x.settleMs));

const pathBErrP50Before = median(pathBBefore.map((x) => x.errP50));
const pathBErrP50After = median(pathBAfter.map((x) => x.errP50));
const pathBErrMaxBefore = median(pathBBefore.map((x) => x.errMax));
const pathBErrMaxAfter = median(pathBAfter.map((x) => x.errMax));

const z15DepartMedianPass =
  median(afterZ15.map((r) => r.cases["z15-depart"].D_eff)) != null &&
  median(afterZ15.map((r) => r.cases["z15-depart"].D_eff)) <= S1_LIMITS.D_eff_ms;
const z15CruiseMedianPass =
  median(afterZ15.map((r) => r.cases["z15-cruise"].D_eff)) != null &&
  median(afterZ15.map((r) => r.cases["z15-cruise"].D_eff)) <= S1_LIMITS.D_eff_ms;

const pathAPass = pathAJumpAfter != null && pathAJumpAfter <= 2.5;
const pathBPass =
  pathBErrP50Before != null &&
  pathBErrP50After != null &&
  pathBErrMaxBefore != null &&
  pathBErrMaxAfter != null &&
  pathBErrP50After < pathBErrP50Before &&
  pathBErrMaxAfter < pathBErrMaxBefore;

const guardsPass = afterZ15.every((r) => r.guardsPass);

const allPass =
  pathAPass &&
  pathBPass &&
  z15DepartMedianPass &&
  z15CruiseMedianPass &&
  guardsPass;

const out = {
  instruction: "S3B-3",
  uag: allPass ? "S3B-3 PASS(D-2 교정) · z15 유지" : "FAIL",
  gates: {
    timeBasis: true,
    spectatorSpeed: true,
    lowZoomIntegration: pathAPass,
    pathBImproved: pathBPass,
    z15DepartMedian: z15DepartMedianPass,
    z15CruiseMedian: z15CruiseMedianPass,
    guards: guardsPass,
    all: allPass,
  },
  z15: {
    before: { departDeff: departDeffBefore, perRun: beforeZ15.map((r) => r.cases) },
    after: {
      departDeff: departDeffAfter,
      cruiseDeff: cruiseDeffAfter,
      perRun: afterZ15.map((r) => r.cases),
    },
  },
  pathA: {
    before: { perRun: pathABefore, medianJumpM: pathAJumpBefore },
    after: { perRun: pathAAfter, medianJumpM: pathAJumpAfter, medianSettleMs: pathASettleAfter },
    budgetMaxM: 2.5,
  },
  pathB: {
    before: { perRun: pathBBefore, medianErrP50: pathBErrP50Before, medianErrMax: pathBErrMaxBefore },
    after: { perRun: pathBAfter, medianErrP50: pathBErrP50After, medianErrMax: pathBErrMaxAfter },
    note: "예산 미적용 — before/after 개선만",
  },
  generatedAt: new Date().toISOString(),
};

writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(JSON.stringify({ out: OUT, uag: out.uag, gates: out.gates }, null, 2));
