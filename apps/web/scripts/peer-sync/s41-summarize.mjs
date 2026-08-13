/**
 * S4-1 — before/after 6 런 → S41-summary.json
 * 쓰기량(pt9)·route in-flight·RTT 대조·z15·경로 B·가드
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
/**
 * S4-1R2 — S41_OUT_TAG 를 주면 **after 런과 출력 파일만** 태그 이름을 쓴다.
 * before 런(S41-before-run 파일)은 그대로 읽기만 한다. 미커밋 S41 after·summary 산출물은 건드리지 않는다.
 */
const OUT_TAG = (process.env.S41_OUT_TAG || "").replace(/[^A-Za-z0-9]/g, "");
const OUT = resolve(DIR, `S41${OUT_TAG}-summary.json`);
const FIXTURE = resolve(DIR, "S3-fixture-gate.json");

const INTERP_DELAY_MS = 160;
const DISCARD_MS = 2_000;
const MAX_DELAY_MS = 3_000;
const DELAY_STEP_MS = 20;
const MIN_OVERLAP = 0.7;
const PATH_B_P50_CAP = 57.0;
const PATH_B_MAX_CAP = 87.0;

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
  return stats(arr).p50;
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

function analyzeRun(raw) {
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

  function pt9In(fromA, toA) {
    const rows = [];
    for (const e of a.filter((x) => x.pt === 9)) {
      const t = num(e.fsWriteStartAt);
      if (t == null) continue;
      if (t < fromA || t > toA) continue;
      rows.push(e);
    }
    const rtts = rows.map((e) => num(e.fsWriteRttMs)).filter((x) => x != null);
    const ok0 = rows.filter((e) => num(e.ok) === 0).length;
    const inFlightMax = Math.max(0, ...rows.map((e) => num(e.inFlightMax) ?? 0), ...rows.map((e) => num(e.inFlight) ?? 0));
    const dur = Math.max(1, (toA - fromA) / 1000);
    return {
      n: rows.length,
      perSec: rows.length / dur,
      windowS: dur,
      ok0,
      rtt: stats(rtts),
      routeInFlightMax: inFlightMax,
    };
  }

  function pt3RttIn(fromA, toA) {
    const rows = a.filter((e) => {
      if (e.pt !== 3) return false;
      const t = num(e.writeStart) ?? num(e.capturedAt);
      return t != null && t >= fromA && t <= toA;
    });
    const rtts = rows.map((e) => num(e.writeRttMs) ?? num(e.rttMs)).filter((x) => x != null);
    const dur = Math.max(1, (toA - fromA) / 1000);
    return { n: rows.length, perSec: rows.length / dur, windowS: dur, rtt: stats(rtts), ok0: rows.filter((e) => num(e.ok) === 0).length };
  }

  function pt11In(fromA, toA) {
    const rows = [];
    for (const e of a.filter((x) => x.pt === 11)) {
      const t = num(e.fsWriteStartAt);
      if (t == null) continue;
      if (t < fromA || t > toA) continue;
      rows.push(e);
    }
    const rtts = rows.map((e) => num(e.fsWriteRttMs)).filter((x) => x != null);
    const dur = Math.max(1, (toA - fromA) / 1000);
    return { n: rows.length, perSec: rows.length / dur, windowS: dur, ok0: rows.filter((e) => num(e.ok) === 0).length, rtt: stats(rtts) };
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
      window: win,
      D_eff: deff.D_eff,
      residualRmse: deff.residualRmse,
      residualMax: deff.residualMax,
      overlap: deff.overlap,
      n: deff.n,
      scalePct,
      scaleStatus: scale.status,
      accPass,
      firestore: pt9In(win.a0, win.a1),
      rtdb: pt3RttIn(win.a0, win.a1),
      touch: pt11In(win.a0, win.a1),
    };
  }

  const depart = judgeCase("z15-depart");
  const cruise = judgeCase("z15-cruise");
  const pt3 = a.filter((e) => e.pt === 3);
  const pt9 = a.filter((e) => e.pt === 9);
  const publishQueue = pt3.map((e) => num(e.publishQueueMs)).filter((x) => x != null);
  const pq = stats(publishQueue);
  const motionInFlightMax = Math.max(0, ...pt3.map((e) => num(e.inFlightMax) ?? 0));
  const routeInFlightMax = Math.max(
    0,
    ...pt9.map((e) => num(e.inFlightMax) ?? 0),
    ...pt9.map((e) => num(e.inFlight) ?? 0),
  );
  let forward = 0;
  let A_first = 0;
  const firstPt4 = new Map();
  for (const e of b.filter((x) => x.pt === 4 && uidOk(x, publisherUid))) {
    if (num(e.first) === 1) firstPt4.set(`${e.uid}:${e.seq}`, e);
  }
  const seenRetro = new Set();
  for (const e of b.filter((x) => x.pt === 5 && uidOk(x, publisherUid))) {
    if (e.result === "discard-forward") forward += 1;
    if (e.result === "discard-retrograde") {
      const key = `${e.uid}:${e.seq}`;
      const f = firstPt4.get(key);
      if (f && Math.abs((num(f.d) ?? NaN) - (num(e.d) ?? NaN)) <= 0.15 && !seenRetro.has(key)) {
        seenRetro.add(key);
        A_first += 1;
      }
    }
  }
  const pt3ok0 = pt3.filter((e) => num(e.ok) === 0).length;
  const pt9ok0 = pt9.filter((e) => num(e.ok) === 0).length;

  const judgedA0 = Math.min(depart.window?.a0 ?? Infinity, cruise.window?.a0 ?? Infinity);
  const judgedA1 = Math.max(depart.window?.a1 ?? 0, cruise.window?.a1 ?? 0);
  const fsAll = pt9In(judgedA0, judgedA1);
  const rtdbAll = pt3RttIn(judgedA0, judgedA1);
  const touchAll = pt11In(judgedA0, judgedA1);

  return {
    phase: raw.phase,
    run: raw.run,
    elapsedMin: raw.elapsedMin,
    cases: { "z15-depart": depart, "z15-cruise": cruise },
    writes: {
      firestore: fsAll,
      rtdb: rtdbAll,
      touch: touchAll,
      byCase: {
        depart: { firestore: depart.firestore, rtdb: depart.rtdb, touch: depart.touch },
        cruise: { firestore: cruise.firestore, rtdb: cruise.rtdb, touch: cruise.touch },
      },
    },
    routeInFlightMax,
    guards: {
      motionInFlightMax: { pass: motionInFlightMax <= 1, got: motionInFlightMax },
      routeInFlightMax: { pass: routeInFlightMax <= 1, got: routeInFlightMax },
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
    },
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
  if (!pt10.length) return { source: "missing-pt10", errP50: null, errMax: null, n: 0 };
  const errs = pt10.map(errFromPt10).filter((x) => x != null);
  const es = stats(errs);
  return { source: "pt10", errP50: es.p50, errMax: es.max, n: pt10.length };
}

function loadRuns(phase) {
  return [1, 2, 3].map((n) => {
    const tag = phase === "after" ? OUT_TAG : "";
    const p = resolve(DIR, `S41${tag}-${phase}-run${n}-events.json`);
    if (!existsSync(p)) throw new Error(`missing ${p}`);
    return JSON.parse(readFileSync(p, "utf8"));
  });
}

const beforeRuns = loadRuns("before");
const afterRuns = loadRuns("after");
const before = beforeRuns.map(analyzeRun);
const after = afterRuns.map(analyzeRun);
const pathBBefore = beforeRuns.map(pathBFromRun).filter(Boolean);
const pathBAfter = afterRuns.map(pathBFromRun).filter(Boolean);

function medField(runs, pick) {
  return median(runs.map(pick).filter((x) => x != null && Number.isFinite(x)));
}

const fsBeforeAll = medField(before, (r) => r.writes.firestore.perSec);
const fsAfterAll = medField(after, (r) => r.writes.firestore.perSec);
const fsBeforeDepart = medField(before, (r) => r.writes.byCase.depart.firestore.perSec);
const fsAfterDepart = medField(after, (r) => r.writes.byCase.depart.firestore.perSec);
const fsBeforeCruise = medField(before, (r) => r.writes.byCase.cruise.firestore.perSec);
const fsAfterCruise = medField(after, (r) => r.writes.byCase.cruise.firestore.perSec);
const fsRatio = fsBeforeAll > 0 ? fsAfterAll / fsBeforeAll : null;

const rtdbBefore = medField(before, (r) => r.writes.rtdb.perSec);
const rtdbAfter = medField(after, (r) => r.writes.rtdb.perSec);
const rtdbRatio = rtdbBefore > 0 ? rtdbAfter / rtdbBefore : null;

const fsRttBefore = {
  p50: medField(before, (r) => r.writes.firestore.rtt.p50),
  p95: medField(before, (r) => r.writes.firestore.rtt.p95),
  max: medField(before, (r) => r.writes.firestore.rtt.max),
};
const fsRttAfter = {
  p50: medField(after, (r) => r.writes.firestore.rtt.p50),
  p95: medField(after, (r) => r.writes.firestore.rtt.p95),
  max: medField(after, (r) => r.writes.firestore.rtt.max),
};
const rtdbRttBefore = {
  p50: medField(before, (r) => r.writes.rtdb.rtt.p50),
  p95: medField(before, (r) => r.writes.rtdb.rtt.p95),
  max: medField(before, (r) => r.writes.rtdb.rtt.max),
};
const rtdbRttAfter = {
  p50: medField(after, (r) => r.writes.rtdb.rtt.p50),
  p95: medField(after, (r) => r.writes.rtdb.rtt.p95),
  max: medField(after, (r) => r.writes.rtdb.rtt.max),
};

const routeInFlightBefore = {
  perRun: before.map((r) => r.routeInFlightMax),
  max: Math.max(...before.map((r) => r.routeInFlightMax)),
  median: median(before.map((r) => r.routeInFlightMax)),
};
const routeInFlightAfter = {
  perRun: after.map((r) => r.routeInFlightMax),
  max: Math.max(...after.map((r) => r.routeInFlightMax)),
  median: median(after.map((r) => r.routeInFlightMax)),
};

const departDeffAfter = medField(after, (r) => r.cases["z15-depart"].D_eff);
const cruiseDeffAfter = medField(after, (r) => r.cases["z15-cruise"].D_eff);
const departRmseAfter = medField(after, (r) => r.cases["z15-depart"].residualRmse);
const cruiseRmseAfter = medField(after, (r) => r.cases["z15-cruise"].residualRmse);
const departMaxAfter = medField(after, (r) => r.cases["z15-depart"].residualMax);
const cruiseMaxAfter = medField(after, (r) => r.cases["z15-cruise"].residualMax);
const departScaleAfter = medField(after, (r) => r.cases["z15-depart"].scalePct);
const cruiseScaleAfter = medField(after, (r) => r.cases["z15-cruise"].scalePct);

const pathBp50After = median(pathBAfter.map((x) => x.errP50));
const pathBmaxAfter = median(pathBAfter.map((x) => x.errMax));
const pathBp50Before = median(pathBBefore.map((x) => x.errP50));
const pathBmaxBefore = median(pathBBefore.map((x) => x.errMax));

const touchBefore = medField(before, (r) => r.writes.touch.perSec);
const touchAfter = medField(after, (r) => r.writes.touch.perSec);

let fixture = null;
try {
  fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
} catch {
  /* optional */
}
const known = fixture?.knownFails ?? [];
const d0 = known.find((f) => f.id === "d0-duplicate-distm");
const d1 = known.find((f) => f.id === "d1-target-vs-applied");
const d0Pass = d0?.pass === true;
const d1Pass = d1?.pass === true;

const gateA =
  fsRatio != null &&
  fsRatio <= 0.5 &&
  fsAfterCruise != null &&
  fsAfterCruise <= 1.3;
const gateB = after.every((r) => r.routeInFlightMax <= 1);
const gateC = after.every((r) => r.guards.pt9_ok0.pass && r.guards.pt3_ok0.pass);
const gateD =
  departDeffAfter != null &&
  departDeffAfter <= S1_LIMITS.D_eff_ms &&
  cruiseDeffAfter != null &&
  cruiseDeffAfter <= S1_LIMITS.D_eff_ms &&
  departRmseAfter != null &&
  departRmseAfter <= S1_LIMITS.residualRmse_m &&
  cruiseRmseAfter != null &&
  cruiseRmseAfter <= S1_LIMITS.residualRmse_m &&
  departMaxAfter != null &&
  departMaxAfter <= S1_LIMITS.residualMax_m &&
  cruiseMaxAfter != null &&
  cruiseMaxAfter <= S1_LIMITS.residualMax_m &&
  (departScaleAfter == null || departScaleAfter <= 10) &&
  (cruiseScaleAfter == null || cruiseScaleAfter <= 10) &&
  after.every((r) => r.cases["z15-depart"].scaleStatus === "PASS" && r.cases["z15-cruise"].scaleStatus === "PASS");
const gateE =
  pathBp50After != null &&
  pathBmaxAfter != null &&
  pathBp50After <= PATH_B_P50_CAP &&
  pathBmaxAfter <= PATH_B_MAX_CAP;
const gateF = after.every(
  (r) =>
    r.guards.motionInFlightMax.pass &&
    r.guards.A_firstOutOfOrder.pass &&
    r.guards.forwardDiscard.pass &&
    r.guards.publishQueueMs.pass,
);
const gateG = rtdbRatio == null || rtdbRatio <= 1.3;

const allPass = gateA && gateB && gateC && gateD && gateE && gateF && gateG;

const rttUnchanged =
  fsRttBefore.p50 != null &&
  fsRttAfter.p50 != null &&
  fsRttAfter.p50 >= 2000 &&
  Math.abs(fsRttAfter.p50 - fsRttBefore.p50) / fsRttBefore.p50 < 0.3;

const out = {
  instruction: "S4-1",
  uag: allPass ? "S4-1 PASS(route 쓰기 폭주 제거) · 정확도 유지" : "FAIL",
  rebuttal: {
    applies: rttUnchanged && gateA,
    note: rttUnchanged
      ? "쓰기 건수는 줄었으나 FS RTT p50 이 2.4~3.0 s 대역에 남아 있음 — 겹침→RTT 예측 반증 가능. 건수 감소만으로 가 성립."
      : "RTT 변화 관측 — 반증 조건 해당 여부 보고서에 평문 기록",
    fsRttBefore,
    fsRttAfter,
    rtdbRttBefore,
    rtdbRttAfter,
  },
  gates: {
    a_fsWriteHalf: gateA,
    b_routeInFlightMax1: gateB,
    c_ok0: gateC,
    d_accuracy: gateD,
    e_pathB: gateE,
    f_guards: gateF,
    g_rtdbWrites: gateG,
    d0_pass: d0Pass !== false,
    d1_pass: d1Pass !== false,
    all: allPass,
  },
  writes: {
    firestore: {
      before: { all: fsBeforeAll, depart: fsBeforeDepart, cruise: fsBeforeCruise },
      after: { all: fsAfterAll, depart: fsAfterDepart, cruise: fsAfterCruise },
      ratio: fsRatio,
    },
    rtdb: { before: rtdbBefore, after: rtdbAfter, ratio: rtdbRatio },
    touch_pt11: { before: touchBefore, after: touchAfter, note: "판정 미사용 · S4-3 이월" },
    rtt: { firestore: { before: fsRttBefore, after: fsRttAfter }, rtdb: { before: rtdbRttBefore, after: rtdbRttAfter } },
  },
  routeInFlight: { before: routeInFlightBefore, after: routeInFlightAfter },
  z15: {
    afterMedian: {
      depart: { D_eff: departDeffAfter, RMSE: departRmseAfter, max: departMaxAfter, scalePct: departScaleAfter },
      cruise: { D_eff: cruiseDeffAfter, RMSE: cruiseRmseAfter, max: cruiseMaxAfter, scalePct: cruiseScaleAfter },
    },
    // S4-1R2 — 판정은 중앙값이지만 꼬리 추세를 보려고 3 런 최댓값도 함께 낸다 (관측용)
    afterMax: {
      depart: {
        D_eff: Math.max(...after.map((r) => r.cases["z15-depart"].D_eff)),
        RMSE: Math.max(...after.map((r) => r.cases["z15-depart"].residualRmse)),
        max: Math.max(...after.map((r) => r.cases["z15-depart"].residualMax)),
      },
      cruise: {
        D_eff: Math.max(...after.map((r) => r.cases["z15-cruise"].D_eff)),
        RMSE: Math.max(...after.map((r) => r.cases["z15-cruise"].residualRmse)),
        max: Math.max(...after.map((r) => r.cases["z15-cruise"].residualMax)),
      },
    },
    beforePerRun: before.map((r) => r.cases),
    afterPerRun: after.map((r) => r.cases),
  },
  pathB: {
    before: { perRun: pathBBefore, medianP50: pathBp50Before, medianMax: pathBmaxBefore },
    after: { perRun: pathBAfter, medianP50: pathBp50After, medianMax: pathBmaxAfter },
    cap: { p50: PATH_B_P50_CAP, max: PATH_B_MAX_CAP },
  },
  perRun: { before, after },
  elapsedMin: {
    before: beforeRuns.map((r) => r.elapsedMin),
    after: afterRuns.map((r) => r.elapsedMin),
  },
  limits: S1_LIMITS,
  generatedAt: new Date().toISOString(),
};

writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      out: OUT,
      uag: out.uag,
      gates: out.gates,
      writes: out.writes,
      routeInFlight: out.routeInFlight,
      rebuttal: out.rebuttal,
    },
    null,
    2,
  ),
);
