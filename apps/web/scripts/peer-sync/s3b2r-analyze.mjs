/**
 * S3B-2R — 공통 분석 (측정 전용). src/ 미변경.
 */
import {
  computeDeffResidualFromSeries,
  computeScaleGate,
  evaluateResidualAtD,
  S1_LIMITS,
} from "./s1-metrics.mjs";

export const INTERP_DELAY_MS = 160;
export const DISCARD_MS = 2_000;
export const MAX_DELAY_MS = 3_000;
export const DELAY_STEP_MS = 20;
export const MIN_OVERLAP = 0.7;
export const FIT_D_MIN = 240;
export const FIT_D_MAX = 480;
export const SPOTLIGHT_D = [300, 320, 340, 350, 360, 380];

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function stats(arr) {
  const a = arr.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return { n: 0, p50: null, p95: null, max: null, min: null };
  const at = (p) => a[Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1))];
  return { n: a.length, min: a[0], p50: at(0.5), p95: at(0.95), max: a[a.length - 1] };
}

function uidOk(e, uid) {
  if (!uid || !e.uid) return true;
  return e.uid === uid;
}

export function windowOf(mark) {
  return {
    a0: (mark?.start?.a ?? 0) + DISCARD_MS,
    a1: mark?.end?.a ?? Infinity,
    b0: (mark?.start?.b ?? 0) + DISCARD_MS,
    b1: mark?.end?.b ?? Infinity,
  };
}

export function extractDepartSeries(raw) {
  const events = raw.events ?? [];
  const publisherUid = raw.publisherUid;
  const a = events.filter((e) => e.side === "A");
  const b = events.filter((e) => e.side === "B");
  const mark = raw.cases?.["z15-depart"];
  if (!mark) return null;
  const win = windowOf(mark);

  const authPad = [];
  for (const e of a.filter((x) => x.pt === 1)) {
    const t = num(e.capturedAt);
    const self = num(e.authDist);
    if (t == null || self == null) continue;
    if (t < win.a0 - MAX_DELAY_MS || t > win.a1) continue;
    authPad.push({ t, self });
  }
  authPad.sort((x, y) => x.t - y.t);

  const disp = [];
  for (const e of b.filter((x) => x.pt === 6 && uidOk(x, publisherUid))) {
    const render = num(e.renderTime);
    if (render == null) continue;
    const t = render + INTERP_DELAY_MS;
    if (t < win.b0 || t > win.b1) continue;
    const d = num(e.displayDistM);
    if (d == null) continue;
    disp.push({
      t,
      disp: d,
      newest: num(e.newestDist) ?? d,
      age: num(e.newestAgeMs) ?? 0,
      buf: num(e.buf) ?? 0,
      spd: num(e.entitySpeedMps) ?? 0,
      mode: e.mode,
      aheadMs: num(e.aheadMs),
      capHit: num(e.capHit),
    });
  }
  disp.sort((x, y) => x.t - y.t);

  return { win, authPad, disp, a, b, publisherUid };
}

export function fitCurveDepart(raw) {
  const s = extractDepartSeries(raw);
  if (!s) return { missing: true };
  const { authPad, disp } = s;
  const deff = computeDeffResidualFromSeries(authPad, disp, {
    clockSkewMs: 0,
    maxDelayMs: MAX_DELAY_MS,
    delayStepMs: DELAY_STEP_MS,
    minOverlapRatio: MIN_OVERLAP,
  });

  const sweep = [];
  for (let D = FIT_D_MIN; D <= FIT_D_MAX; D += DELAY_STEP_MS) {
    const pt = evaluateResidualAtD(authPad, disp, D, {
      clockSkewMs: 0,
      minOverlapRatio: MIN_OVERLAP,
    });
    sweep.push(pt);
  }

  const spotlight = {};
  for (const D of SPOTLIGHT_D) {
    spotlight[D] = evaluateResidualAtD(authPad, disp, D, {
      clockSkewMs: 0,
      minOverlapRatio: MIN_OVERLAP,
    });
  }

  const rmse350 = spotlight[350]?.residualRmse;
  const rmse360 = spotlight[360]?.residualRmse;
  const rmse340 = spotlight[340]?.residualRmse;
  let distinguish350vs360 = null;
  if (rmse350 != null && rmse360 != null) {
    const delta = Math.abs(rmse350 - rmse360);
    const local = [rmse340, rmse350, rmse360]
      .filter((x) => x != null)
      .sort((x, y) => x - y);
    const localSpread = local.length >= 2 ? local[local.length - 1] - local[0] : 0;
    distinguish350vs360 = {
      rmse350,
      rmse360,
      delta,
      localSpread,
      distinguishable: delta > localSpread,
      note: "350 은 20ms 격자 밖 — off-grid 평가. delta>localSpread 이면 구별",
    };
  }

  const atDeff = evaluateResidualAtD(authPad, disp, deff.D_eff ?? 0, {
    clockSkewMs: 0,
    minOverlapRatio: MIN_OVERLAP,
  });

  return {
    D_eff: deff.D_eff,
    residualRmse: deff.residualRmse,
    residualMax: deff.residualMax,
    overlap: deff.overlap,
    n: deff.n,
    residualMeanAtDeff: atDeff.residualMean,
    sweep,
    spotlight,
    distinguish350vs360,
    grid: { stepMs: DELAY_STEP_MS, min: FIT_D_MIN, max: FIT_D_MAX, budgetMs: S1_LIMITS.D_eff_ms },
  };
}

export function departMechanics(raw) {
  const s = extractDepartSeries(raw);
  if (!s) return { missing: true };
  const { win, a, b, publisherUid } = s;

  const pt3 = a
    .filter((e) => e.pt === 3)
    .map((e) => ({
      t: num(e.writeStart) ?? num(e.capturedAt),
      distM: num(e.d),
      speedMps: num(e.v),
    }))
    .filter((e) => e.t != null && e.distM != null && e.t >= win.a0 && e.t <= win.a1)
    .sort((x, y) => x.t - y.t);

  const published = pt3.map((e) => e.speedMps).filter((v) => v != null && v > 0.02);
  const actual = [];
  for (let i = 1; i < pt3.length; i++) {
    const dt = (pt3[i].t - pt3[i - 1].t) / 1000;
    if (dt < 0.05) continue;
    actual.push((pt3[i].distM - pt3[i - 1].distM) / dt);
  }

  const pt6 = b.filter(
    (e) => e.pt === 6 && uidOk(e, publisherUid) && num(e.renderTime) != null,
  );
  const pt6InWin = pt6.filter((e) => {
    const t = (num(e.renderTime) ?? 0) + INTERP_DELAY_MS;
    return t >= win.b0 && t <= win.b1;
  });
  const modes = pt6InWin.map((e) => e.mode);
  const extrap = modes.filter((m) => m === "extrapolate").length;
  const capHits = pt6InWin.filter((e) => num(e.capHit) === 1).length;
  const ahead = pt6InWin.map((e) => num(e.aheadMs)).filter((x) => x != null);

  const pubP50 = stats(published).p50;
  const actP50 = stats(actual).p50;

  const curve = fitCurveDepart(raw);

  return {
    publishedSpeedMpsP50: pubP50,
    actualProgressMpsP50: actP50,
    publishOverActual: pubP50 != null && actP50 != null && actP50 > 0 ? pubP50 / actP50 : null,
    extrapolateShare: modes.length ? extrap / modes.length : null,
    capHitRate: pt6InWin.length ? capHits / pt6InWin.length : null,
    aheadMs: stats(ahead),
    residualMeanAtDeff: curve.residualMeanAtDeff,
    pt3n: pt3.length,
    pt6n: pt6InWin.length,
  };
}

export function analyzeRun(raw) {
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
    const hitCeiling = deff.D_eff != null && deff.D_eff === MAX_DELAY_MS;
    const scalePct = scale.ratio != null && Number.isFinite(scale.ratio) ? scale.ratio * 100 : null;
    const accPass =
      deff.D_eff != null &&
      deff.D_eff <= S1_LIMITS.D_eff_ms &&
      deff.residualRmse <= S1_LIMITS.residualRmse_m &&
      deff.residualMax <= S1_LIMITS.residualMax_m &&
      scale.status === "PASS" &&
      !hitCeiling;
    return {
      id,
      windowS: scale.windowMs / 1000,
      deltaA_auth: scale.deltaSelfM,
      scalePct,
      scaleStatus: scale.status,
      D_eff: deff.D_eff,
      residualRmse: deff.residualRmse,
      residualMax: deff.residualMax,
      overlap: deff.overlap,
      n: deff.n,
      hitCeiling,
      accPass,
    };
  }

  const depart = judgeCase("z15-depart");
  const cruise = judgeCase("z15-cruise");
  const pt3 = a.filter((e) => e.pt === 3);
  const pt9 = a.filter((e) => e.pt === 9);
  const publishQueue = pt3.map((e) => num(e.publishQueueMs)).filter((x) => x != null);
  const pq = stats(publishQueue);
  const inFlightMax = Math.max(0, ...pt3.map((e) => num(e.inFlightMax) ?? 0));

  let forward = 0;
  for (const e of b.filter((x) => x.pt === 5 && uidOk(x, publisherUid))) {
    if (e.result === "discard-forward") forward += 1;
  }

  const firstPt4 = [];
  for (const e of b.filter((x) => x.pt === 4 && uidOk(x, publisherUid))) {
    if (num(e.first) === 1) firstPt4.push(e);
  }
  const firstMap = new Map(firstPt4.map((e) => [`${e.uid}:${e.seq}`, e]));
  const retro = b.filter((e) => e.pt === 5 && e.result === "discard-retrograde" && uidOk(e, publisherUid));
  const seen = new Set();
  let A_first = 0;
  for (const e of retro) {
    if (num(e.seq) == null) continue;
    const key = `${e.uid}:${e.seq}`;
    const f = firstMap.get(key);
    const same = f && Math.abs((num(f.d) ?? NaN) - (num(e.d) ?? NaN)) <= 0.15;
    if (same && !seen.has(key)) {
      seen.add(key);
      A_first += 1;
    }
  }

  const pt3ok0 = pt3.filter((e) => num(e.ok) === 0).length;
  const pt9ok0 = pt9.filter((e) => num(e.ok) === 0).length;

  const guards = {
    inFlightMax: { pass: inFlightMax <= 1, got: inFlightMax },
    A_firstOutOfOrder: { pass: A_first === 0, got: A_first },
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
      got: { ...pq, over1s: publishQueue.filter((x) => x > 1000).length },
    },
    cruiseAcc: {
      pass:
        cruise.D_eff != null &&
        cruise.D_eff <= S1_LIMITS.D_eff_ms &&
        cruise.residualRmse <= S1_LIMITS.residualRmse_m &&
        cruise.residualMax <= S1_LIMITS.residualMax_m &&
        cruise.scaleStatus === "PASS",
      got: cruise,
    },
  };

  return {
    run: raw.run ?? null,
    elapsedMin: raw.elapsedMin,
    cases: { "z15-depart": depart, "z15-cruise": cruise },
    guards,
    guardsPass: Object.values(guards).every((g) => g.pass),
  };
}
