/**
 * S3A-V — S3AV-chain-events.json → S3AV-summary.json
 * 제품 코드 변경 없음. 판정은 A_auth 대 B_disp + 승인된 스케일 게이트.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeDeffResidualFromSeries,
  computeScaleGate,
  overlapAtDelay,
  S1_LIMITS,
} from "./s1-metrics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../../../../document/ops/sync-relay");
const EVENTS = resolve(DIR, process.argv[2] || "S3AV-chain-events.json");
const OUT = resolve(DIR, process.argv[3] || "S3AV-summary.json");

const INTERP_DELAY_MS = 160;
const DISCARD_MS = 2_000;
const MAX_DELAY_MS = 3_000;
const MIN_OVERLAP = 0.7;
const GEO_SAFE_M = 1029;

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

function histogram(arr, edges) {
  const bins = edges.slice(0, -1).map((lo, i) => ({ lo, hi: edges[i + 1], n: 0 }));
  const overflow = { lo: edges[edges.length - 1], hi: null, n: 0 };
  for (const x of arr) {
    if (!Number.isFinite(x)) continue;
    const bin = bins.find((b) => x >= b.lo && x < b.hi);
    if (bin) bin.n += 1;
    else if (x >= edges[edges.length - 1]) overflow.n += 1;
  }
  return [...bins, overflow];
}

const raw = JSON.parse(readFileSync(EVENTS, "utf8"));
const events = raw.events ?? [];
const publisherUid = raw.publisherUid;
const before = num(raw.clockSkewBefore);
const after = num(raw.clockSkewAfter);
const tB0 = num(raw.clockRangeB?.start);
const tB1 = num(raw.clockRangeB?.end);
const skewDelta = before != null && after != null ? after - before : null;
const skewInterpolated = skewDelta != null && Math.abs(skewDelta) > 100;

function skewAtB(tB) {
  if (before == null || after == null) return null;
  if (!skewInterpolated) return Math.round((before + after) / 2);
  if (tB0 == null || tB1 == null || tB1 <= tB0) return Math.round((before + after) / 2);
  const u = Math.min(1, Math.max(0, (tB - tB0) / (tB1 - tB0)));
  return before + (after - before) * u;
}

function clockSkewMsFor(tB) {
  const s = skewAtB(tB);
  return s == null ? null : s;
}

const a = events.filter((e) => e.side === "A");
const b = events.filter((e) => e.side === "B");

function uidOk(e) {
  if (!publisherUid || !e.uid) return true;
  return e.uid === publisherUid;
}

/** A_auth: pt1 authDist @ capturedAt (A 시계) */
function authSeries(fromA, toA) {
  const rows = [];
  for (const e of a.filter((x) => x.pt === 1)) {
    const t = num(e.capturedAt);
    const self = num(e.authDist);
    if (t == null || self == null) continue;
    if (fromA != null && t < fromA) continue;
    if (toA != null && t > toA) continue;
    rows.push({ t, self, snapshotDist: num(e.snapshotDist), geoLen: num(e.geoLen) });
  }
  rows.sort((x, y) => x.t - y.t);
  return rows;
}

/** B 화면: pt6 displayDistM. t = renderTime + 160 = B nowMs */
function dispSeries(fromB, toB) {
  const rows = [];
  for (const e of b.filter((x) => x.pt === 6 && uidOk(x))) {
    const render = num(e.renderTime);
    if (render == null) continue;
    const t = render + INTERP_DELAY_MS;
    if (fromB != null && t < fromB) continue;
    if (toB != null && t > toB) continue;
    const disp = num(e.displayDistM);
    const newest = num(e.newestDist) ?? num(e.s1Dist) ?? num(e.oldestDist);
    if (disp == null) continue;
    rows.push({
      t,
      disp,
      newest: newest ?? disp,
      age: num(e.newestAgeMs) ?? 0,
      buf: num(e.buf) ?? 0,
      spd: num(e.entitySpeedMps) ?? 0,
      mode: e.mode,
      aheadMsRaw: num(e.aheadMsRaw),
      capHit: num(e.capHit),
    });
  }
  rows.sort((x, y) => x.t - y.t);
  return rows;
}

/** 스케일용 B_newest — 수용된 pt5.d @ 대응 pt4 recvAt */
function newestSeries(fromB, toB) {
  const firstPt4 = new Map();
  for (const e of b.filter((x) => x.pt === 4 && uidOk(x))) {
    const key = `${e.uid}:${e.seq}`;
    if (!firstPt4.has(key)) firstPt4.set(key, e);
  }
  const rows = [];
  for (const e of b.filter((x) => x.pt === 5 && x.result === "accepted" && uidOk(x))) {
    const p4 = firstPt4.get(`${e.uid}:${e.seq}`);
    const t = num(p4?.recvAt) ?? num(p4?.firstSeenAt);
    const newest = num(e.d);
    if (t == null || newest == null) continue;
    if (fromB != null && t < fromB) continue;
    if (toB != null && t > toB) continue;
    rows.push({ t, newest, disp: newest, age: 0, buf: 0, spd: 0 });
  }
  rows.sort((x, y) => x.t - y.t);
  return rows;
}

function toAclock(bRows) {
  const out = [];
  for (const r of bRows) {
    const skew = clockSkewMsFor(r.t);
    if (skew == null) continue;
    out.push({ ...r, t: r.t - skew });
  }
  return out;
}

function judgeCaseWindow(id, mark, judged) {
  const discardMs = DISCARD_MS;
  const a0 = (mark?.start?.a ?? 0) + discardMs;
  const a1 = mark?.end?.a ?? Infinity;
  const b0 = (mark?.start?.b ?? 0) + discardMs;
  const b1 = mark?.end?.b ?? Infinity;

  const authAll = authSeries(a0, a1);
  const dispB = dispSeries(b0, b1);
  const newestB = newestSeries(b0, b1);
  const dispA = toAclock(dispB);
  const newestA = toAclock(newestB);

  const midB = dispB.length ? dispB[Math.floor(dispB.length / 2)].t : b0;
  const skewUsed = clockSkewMsFor(midB);

  const guards = {
    g1_discard2s: {
      pass: true,
      discardedMs: discardMs,
      note: "F-1 visibilityNowMs=0 회피. 케이스 시작 후 2 s 폐기",
    },
    g2_premise: { pass: false },
    g3_overlap: { pass: false, minOverlapRatio: MIN_OVERLAP },
    g4_ceiling: { pass: false, maxDelayMs: MAX_DELAY_MS, hitCeiling: false },
    g5_clock: {
      pass: before != null && after != null,
      before,
      after,
      interpolated: skewInterpolated,
      skewUsed,
    },
  };

  const geoLens = authAll.map((r) => r.geoLen).filter((x) => x != null);
  const maxAuth = authAll.length ? authAll[authAll.length - 1].self : null;
  const clampRisk = maxAuth != null && geoLens.length && maxAuth >= Math.min(...geoLens) - 1;

  const scale = computeScaleGate(authAll, newestA, { minDeltaSelfM: 100, minWindowMs: 20_000 });
  guards.g2_premise = {
    pass: scale.status !== "판정 유보",
    deltaSelfM: scale.deltaSelfM,
    windowMs: scale.windowMs,
    reason: scale.reason,
  };

  const deff = computeDeffResidualFromSeries(authAll, dispA, {
    clockSkewMs: 0,
    maxDelayMs: MAX_DELAY_MS,
    delayStepMs: 20,
    minOverlapRatio: MIN_OVERLAP,
  });
  const ov = overlapAtDelay(authAll, dispA, deff.D_eff ?? 0, { clockSkewMs: 0 });
  guards.g3_overlap = {
    pass: (deff.overlap ?? 0) >= MIN_OVERLAP && deff.status === "ok",
    overlap: deff.overlap ?? ov.overlap,
    looked: ov.looked,
    hit: ov.hit,
  };
  const hitCeiling = deff.D_eff != null && deff.D_eff === MAX_DELAY_MS;
  guards.g4_ceiling = {
    pass: deff.D_eff != null && !hitCeiling,
    maxDelayMs: MAX_DELAY_MS,
    hitCeiling,
    D_eff: deff.D_eff,
    status: deff.status,
  };

  const guardFails = Object.entries(guards)
    .filter(([, g]) => !g.pass)
    .map(([k]) => k);

  let verdict = "판정 유보";
  let scalePct = scale.ratio != null && Number.isFinite(scale.ratio) ? scale.ratio * 100 : null;
  if (guardFails.length === 0 && judged) {
    const accPass =
      deff.D_eff != null &&
      deff.D_eff <= S1_LIMITS.D_eff_ms &&
      deff.residualRmse <= S1_LIMITS.residualRmse_m &&
      deff.residualMax <= S1_LIMITS.residualMax_m;
    const scalePass = scale.status === "PASS";
    verdict = scalePass && accPass ? "PASS" : "미종결";
  } else if (!judged) {
    verdict = "기록만 (판정 제외)";
  }

  const link12 = authAll
    .filter((r) => r.snapshotDist != null)
    .map((r) => Math.abs(r.self - r.snapshotDist));

  return {
    id,
    judged,
    discardMs,
    window: { a0, a1, b0, b1 },
    deltaA_auth: scale.deltaSelfM,
    windowS: scale.windowMs / 1000,
    scaleRatio: scale.ratio,
    scalePct,
    scaleStatus: scale.status,
    D_eff: deff.D_eff,
    residualRmse: deff.residualRmse,
    residualMax: deff.residualMax,
    residualP95: deff.residualP95,
    deffN: deff.n,
    deffOverlap: deff.overlap,
    hitCeiling,
    guards,
    guardFails,
    verdict,
    maxAuth,
    clampRisk: !!clampRisk,
    link12: stats(link12),
    modes: modeOccupancy(dispB),
    extrapErr: extrapVsA(dispB, authAll),
    nAuth: authAll.length,
    nDisp: dispB.length,
    nNewest: newestA.length,
  };
}

function modeOccupancy(dispB) {
  const counts = { interpolate: 0, extrapolate: 0, oldest: 0, paused: 0 };
  for (const r of dispB) {
    if (counts[r.mode] != null) counts[r.mode] += 1;
  }
  const n = Object.values(counts).reduce((s, x) => s + x, 0) || 1;
  return {
    counts,
    occupancy: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / n])),
  };
}

function extrapVsA(dispB, authAll) {
  const errs = [];
  const ahead = [];
  let capHits = 0;
  let nEx = 0;
  for (const r of dispB) {
    if (r.mode !== "extrapolate") continue;
    nEx += 1;
    if (r.aheadMsRaw != null) ahead.push(r.aheadMsRaw);
    if (r.capHit === 1) capHits += 1;
    const skew = clockSkewMsFor(r.t) ?? 0;
    const tA0 = r.t - skew;
    const tA1 = tA0 + (r.aheadMsRaw ?? 0);
    // A 실제 이동 vs ahead*spd — 기존 S3R 과 같이 auth 보간 차
    const a0 = interpAuth(authAll, tA0);
    const a1 = interpAuth(authAll, tA1);
    if (a0 != null && a1 != null && r.newest != null && r.aheadMsRaw != null && r.spd != null) {
      const expectedMove = (r.spd * Math.min(r.aheadMsRaw, 1200)) / 1000;
      errs.push(Math.abs(a1 - a0 - expectedMove));
    }
  }
  return {
    n: nEx,
    capHitRate: nEx ? capHits / nEx : 0,
    aheadMs: stats(ahead),
    errorVsA_m: stats(errs),
  };
}

function interpAuth(rows, t) {
  if (!rows.length || t == null) return null;
  if (t < rows[0].t || t > rows[rows.length - 1].t) return null;
  for (let i = 1; i < rows.length; i++) {
    if (t <= rows[i].t) {
      const a0 = rows[i - 1];
      const a1 = rows[i];
      const u = (t - a0.t) / Math.max(1, a1.t - a0.t);
      return a0.self + (a1.self - a0.self) * u;
    }
  }
  return null;
}

const cases = raw.cases ?? {};
const judgedIds = ["z15-depart", "z15-cruise"];
const recordIds = ["z13"];

const caseResults = {};
for (const id of [...judgedIds, ...recordIds]) {
  if (!cases[id]) {
    caseResults[id] = { id, verdict: judgedIds.includes(id) ? "판정 유보" : "기록만 (판정 제외)", missing: true };
    continue;
  }
  caseResults[id] = judgeCaseWindow(id, cases[id], judgedIds.includes(id));
}

// §4 가. accepted 간격 (전 세션, 판정 창과 별개 기록)
const acceptedT = newestSeries(null, null).map((r) => r.t);
const gaps = [];
for (let i = 1; i < acceptedT.length; i++) gaps.push(acceptedT[i] - acceptedT[i - 1]);

const pt2 = a.filter((e) => e.pt === 2).length;
const pt3 = a.filter((e) => e.pt === 3);
const pt3ok0 = pt3.filter((e) => num(e.ok) === 0).length;
const pt3ok1 = pt3.filter((e) => num(e.ok) === 1).length;

const firstPt4 = [];
const repeatPt4 = [];
for (const e of b.filter((x) => x.pt === 4 && uidOk(x))) {
  if (num(e.first) === 1) firstPt4.push(e);
  else repeatPt4.push(e);
}
const pt5 = b.filter((e) => e.pt === 5 && uidOk(e));
const retro = pt5.filter((e) => e.result === "discard-retrograde");
const firstMap = new Map(firstPt4.map((e) => [`${e.uid}:${e.seq}`, e]));
let A_firstOutOfOrder = 0;
const seenA = new Set();
for (const e of retro) {
  if (num(e.seq) == null) continue;
  const key = `${e.uid}:${e.seq}`;
  const f = firstMap.get(key);
  const same = f && Math.abs((num(f.d) ?? NaN) - (num(e.d) ?? NaN)) <= 0.15;
  if (same && !seenA.has(key)) {
    seenA.add(key);
    A_firstOutOfOrder += 1;
  }
}
const inFlightMax = Math.max(0, ...pt3.map((e) => num(e.inFlightMax) ?? 0));
const publishQueue = pt3.map((e) => num(e.publishQueueMs)).filter((x) => x != null);

const cruise = caseResults["z15-cruise"];
const depart = caseResults["z15-depart"];
const rebuttalApplies = cruise && cruise.judged && cruise.guardFails?.length === 0 && cruise.scaleStatus === "FAIL";

const judgedVerdicts = judgedIds.map((id) => caseResults[id]?.verdict);
let uag = "판정 유보";
if (judgedVerdicts.every((v) => v === "PASS")) uag = "S3A 대상인 z15 위치 불일치 종결";
else if (judgedVerdicts.some((v) => v === "판정 유보" || v == null)) uag = "판정 유보";
else uag = "미종결";

const out = {
  instruction: "S3A-V",
  elapsedMin: raw.elapsedMin,
  publisherUid,
  clockSkewBefore: before,
  clockSkewAfter: after,
  clockSkewInterpolated: skewInterpolated,
  clockSkewMs:
    before != null && after != null ? (skewInterpolated ? "linear(before→after)" : Math.round((before + after) / 2)) : null,
  eventCounts: {
    A: a.length,
    B: b.length,
    total: events.length,
    pt: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((p) => [p, events.filter((e) => e.pt === p).length])),
  },
  rebuttal: {
    applies: !!rebuttalApplies,
    note: rebuttalApplies
      ? "z15-cruise 스케일 게이트 FAIL → S3A 로 증상이 해결됐다는 감리 판단 반증. 원인 탐색 금지."
      : "반증 불성립",
  },
  uag,
  cases: caseResults,
  observe: {
    ga_acceptedIntervalMs: {
      ...stats(gaps),
      histogram: histogram(gaps, [0, 100, 200, 400, 800, 1600]),
      note: "연속 accepted recvAt 차. 점유율 역산 아님",
    },
    na_modes: {
      depart: depart?.modes ?? null,
      cruise: cruise?.modes ?? null,
      z13: caseResults.z13?.modes ?? null,
    },
    da_extrapErr: {
      depart: depart?.extrapErr ?? null,
      cruise: cruise?.extrapErr ?? null,
    },
    ra_rtdbWrite: {
      pt3_ok0: pt3ok0,
      pt3_ok1: pt3ok1,
      failRate: pt3.length ? pt3ok0 / pt3.length : null,
      note: "실패 판정은 pt3 ok=0 만. F-2 수정 금지",
    },
    ra_incomplete: {
      pt2,
      pt3: pt3.length,
      pt2_minus_pt3: pt2 - pt3.length,
      note: "미완료·로그 누락 후보. 실패로 세지 않음",
    },
    ma_link12: {
      depart: depart?.link12 ?? null,
      cruise: cruise?.link12 ?? null,
      note: "A_auth − A_snap. clamp 미발화 확인",
    },
    ba_internal: {
      publishQueueMs: stats(publishQueue),
      inFlightMax,
      A_firstOutOfOrder,
      note: "S3A 대비 유지 확인용. 이번 판정 근거 아님",
    },
  },
  f1_f2: {
    F1: "visibilityNowMs 초기 0 — 측정에서 앞 2s 폐기로 회피. 미수정",
    F2: "motionPublishFlight fire-and-forget. pt3 ok=0 으로만 관측. 미수정",
  },
  geoSafeM: GEO_SAFE_M,
  limits: S1_LIMITS,
};

writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      out: OUT,
      uag,
      rebuttal: out.rebuttal.applies,
      cruise: cruise && { verdict: cruise.verdict, D_eff: cruise.D_eff, scalePct: cruise.scalePct, guards: cruise.guardFails },
      depart: depart && { verdict: depart.verdict, D_eff: depart.D_eff, scalePct: depart.scalePct, guards: depart.guardFails },
    },
    null,
    2,
  ),
);
