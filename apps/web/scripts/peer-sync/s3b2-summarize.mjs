/**
 * S3B-2 — S3B2-base-events.json + S3B2-chain-events.json → S3B2-summary.json
 * skew=0. pt9 건수로 Firestore 쓰기량. S3B1 대비 z15 회귀.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeDeffResidualFromSeries, computeScaleGate, S1_LIMITS } from "./s1-metrics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../../../../document/ops/sync-relay");
const BASE = resolve(DIR, "S3B2-base-events.json");
const POST = resolve(DIR, "S3B2-chain-events.json");
const OUT = resolve(DIR, "S3B2-summary.json");
const S3B1 = resolve(DIR, "S3B1-summary.json");

const INTERP_DELAY_MS = 160;
const DISCARD_MS = 2_000;
const MAX_DELAY_MS = 3_000;
const MIN_OVERLAP = 0.7;

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

function analyze(raw) {
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
      rows.push({ t, self, snapshotDist: num(e.snapshotDist), appliedKmh: num(e.appliedKmh) });
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
        newest: num(e.newestDist) ?? num(e.s1Dist) ?? disp,
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
    const dur = Math.max(1, (toA - fromA) / 1000);
    return {
      n: rows.length,
      perSec: rows.length / dur,
      windowS: dur,
      ok0,
      rtt: stats(rtts),
    };
  }

  function rtdbIn(fromA, toA) {
    const writes = a.filter((e) => {
      if (e.pt !== 3) return false;
      const t = num(e.writeStart) ?? num(e.capturedAt);
      return t != null && t >= fromA && t <= toA;
    });
    const dur = Math.max(1, (toA - fromA) / 1000);
    return { n: writes.length, perSec: writes.length / dur, windowS: dur };
  }

  function discardCounts() {
    const out = { sameDist: 0, forward: 0, retrograde: 0, accepted: 0 };
    for (const e of b.filter((x) => x.pt === 5 && uidOk(x, publisherUid))) {
      if (e.result === "dup-same-dist") out.sameDist += 1;
      else if (e.result === "discard-forward") out.forward += 1;
      else if (e.result === "discard-retrograde") out.retrograde += 1;
      else if (e.result === "accepted") out.accepted += 1;
    }
    return out;
  }

  function retrogradeA() {
    const firstPt4 = [];
    for (const e of b.filter((x) => x.pt === 4 && uidOk(x, publisherUid))) {
      if (num(e.first) === 1) firstPt4.push(e);
    }
    const firstMap = new Map(firstPt4.map((e) => [`${e.uid}:${e.seq}`, e]));
    const retro = b.filter((e) => e.pt === 5 && e.result === "discard-retrograde" && uidOk(e, publisherUid));
    const seen = new Set();
    let A = 0;
    for (const e of retro) {
      if (num(e.seq) == null) continue;
      const key = `${e.uid}:${e.seq}`;
      const f = firstMap.get(key);
      const same = f && Math.abs((num(f.d) ?? NaN) - (num(e.d) ?? NaN)) <= 0.15;
      if (same && !seen.has(key)) {
        seen.add(key);
        A += 1;
      }
    }
    return A;
  }

  /** 출발 구간 발행 속도가 5km/h(1.39 m/s)에 고착인지 */
  function departSpeedStuck(win) {
    const pts = a.filter((e) => {
      if (e.pt !== 3) return false;
      const t = num(e.writeStart) ?? num(e.capturedAt);
      return t != null && t >= win.a0 && t <= win.a1;
    });
    const speeds = pts.map((e) => num(e.v)).filter((x) => x != null);
    if (!speeds.length) return { stuck: null, n: 0 };
    const near139 = speeds.filter((v) => Math.abs(v - 1.39) < 0.05).length;
    const p50 = stats(speeds).p50;
    const max = stats(speeds).max;
    return {
      n: speeds.length,
      p50,
      max,
      near139Ratio: near139 / speeds.length,
      stuckAt5kmh: near139 / speeds.length >= 0.8 && (max ?? 0) < 2,
    };
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
      delayStepMs: 20,
      minOverlapRatio: MIN_OVERLAP,
    });
    const hitCeiling = deff.D_eff != null && deff.D_eff === MAX_DELAY_MS;
    const accPass =
      deff.D_eff != null &&
      deff.D_eff <= S1_LIMITS.D_eff_ms &&
      deff.residualRmse <= S1_LIMITS.residualRmse_m &&
      deff.residualMax <= S1_LIMITS.residualMax_m &&
      scale.status === "PASS" &&
      !hitCeiling;
    return {
      id,
      window: win,
      deltaA_auth: scale.deltaSelfM,
      windowS: scale.windowMs / 1000,
      scalePct: scale.ratio != null && Number.isFinite(scale.ratio) ? scale.ratio * 100 : null,
      scaleStatus: scale.status,
      D_eff: deff.D_eff,
      residualRmse: deff.residualRmse,
      residualMax: deff.residualMax,
      overlap: deff.overlap,
      hitCeiling,
      accPass,
      rtdb: rtdbIn(win.a0, win.a1),
      firestore: pt9In(win.a0, win.a1),
      departSpeed: id === "z15-depart" ? departSpeedStuck(win) : null,
    };
  }

  const depart = judgeCase("z15-depart");
  const cruise = judgeCase("z15-cruise");
  const pt3 = a.filter((e) => e.pt === 3);
  const pt9 = a.filter((e) => e.pt === 9);
  const publishQueue = pt3.map((e) => num(e.publishQueueMs)).filter((x) => x != null);
  const pq = stats(publishQueue);
  const inFlightMax = Math.max(0, ...pt3.map((e) => num(e.inFlightMax) ?? 0));
  const disc = discardCounts();
  const A_first = retrogradeA();
  const pt3ok0 = pt3.filter((e) => num(e.ok) === 0).length;
  const pt9ok0 = pt9.filter((e) => num(e.ok) === 0).length;

  const judgedA0 = Math.min(depart.window?.a0 ?? Infinity, cruise.window?.a0 ?? Infinity);
  const judgedA1 = Math.max(depart.window?.a1 ?? 0, cruise.window?.a1 ?? 0);
  const rtdbAll = rtdbIn(judgedA0, judgedA1);
  const fsAll = pt9In(judgedA0, judgedA1);

  return {
    phase: raw.phase,
    elapsedMin: raw.elapsedMin,
    publisherUid,
    eventCounts: {
      A: a.length,
      B: b.length,
      total: events.length,
      pt: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 9].map((p) => [p, events.filter((e) => e.pt === p).length])),
    },
    cases: { "z15-depart": depart, "z15-cruise": cruise },
    regression: {
      inFlightMax: { pass: inFlightMax <= 1, got: inFlightMax },
      A_firstOutOfOrder: { pass: A_first === 0, got: A_first },
      forwardDiscard: { pass: disc.forward === 0, got: disc.forward },
      pt3_ok0: { pass: pt3ok0 === 0, got: pt3ok0 },
      pt9_ok0: { pass: pt9ok0 === 0, got: pt9ok0 },
      publishQueueMs: {
        pass: pq.p50 != null && pq.p50 <= 150 && pq.p95 <= 400 && pq.max <= 800 && !publishQueue.some((x) => x > 1000),
        got: { ...pq, over1s: publishQueue.filter((x) => x > 1000).length },
      },
    },
    writes: {
      rtdb: rtdbAll,
      firestore: fsAll,
      discard: disc,
      byCase: {
        depart: { rtdb: depart.rtdb, firestore: depart.firestore },
        cruise: { rtdb: cruise.rtdb, firestore: cruise.firestore },
      },
    },
    accuracyPass: !!(depart.accPass && cruise.accPass),
  };
}

if (!existsSync(BASE) || !existsSync(POST)) {
  console.error("need both S3B2-base-events.json and S3B2-chain-events.json");
  process.exit(1);
}

const base = analyze(JSON.parse(readFileSync(BASE, "utf8")));
const post = analyze(JSON.parse(readFileSync(POST, "utf8")));

const rtdbRatio =
  base.writes.rtdb.perSec > 0 ? post.writes.rtdb.perSec / base.writes.rtdb.perSec : null;
const fsRatio =
  base.writes.firestore.perSec > 0
    ? post.writes.firestore.perSec / base.writes.firestore.perSec
    : null;
const fsDepartRatio =
  base.writes.byCase.depart.firestore.perSec > 0
    ? post.writes.byCase.depart.firestore.perSec / base.writes.byCase.depart.firestore.perSec
    : null;
const fsCruiseRatio =
  base.writes.byCase.cruise.firestore.perSec > 0
    ? post.writes.byCase.cruise.firestore.perSec / base.writes.byCase.cruise.firestore.perSec
    : null;

const g34 = {
  rtdb: { base: base.writes.rtdb, post: post.writes.rtdb, ratio: rtdbRatio, pass: rtdbRatio == null || rtdbRatio <= 1.3 },
  firestore: {
    base: base.writes.firestore,
    post: post.writes.firestore,
    ratio: fsRatio,
    pass: fsRatio == null || fsRatio <= 1.3,
    byCase: {
      depart: { base: base.writes.byCase.depart.firestore, post: post.writes.byCase.depart.firestore, ratio: fsDepartRatio },
      cruise: { base: base.writes.byCase.cruise.firestore, post: post.writes.byCase.cruise.firestore, ratio: fsCruiseRatio },
    },
  },
};

const departStuck = post.cases["z15-depart"]?.departSpeed;
const d1Fixed = departStuck && departStuck.stuckAt5kmh === false;

const g33 = post.regression;
const reg33 = Object.values(g33).every((x) => x.pass);
const acc32 = post.accuracyPass;
const write34 = g34.rtdb.pass && g34.firestore.pass;

// known-fail d1: post pt3 vs progress in first 6s of depart
function d1FromPost() {
  const raw = JSON.parse(readFileSync(POST, "utf8"));
  const pub = raw.publisherUid;
  const a = (raw.events ?? []).filter((e) => e.side === "A" && e.pt === 3 && (!pub || !e.uid || e.uid === pub));
  const mark = raw.cases?.["z15-depart"];
  if (!mark || a.length < 2) return null;
  const t0 = (mark.start?.a ?? 0) + DISCARD_MS;
  const t1 = t0 + 6_000;
  const inWin = a
    .map((e) => ({ atMs: num(e.writeStart) ?? num(e.capturedAt), distM: num(e.d), speedMps: num(e.v) }))
    .filter((e) => e.atMs != null && e.distM != null && e.atMs >= t0 && e.atMs <= t1)
    .sort((x, y) => x.atMs - y.atMs);
  if (inWin.length < 2) return null;
  const first = inWin[0];
  const last = inWin[inWin.length - 1];
  const dt = (last.atMs - first.atMs) / 1000;
  if (dt < 1) return null;
  const actualMps = (last.distM - first.distM) / dt;
  const published = inWin.map((e) => e.speedMps).filter((v) => v != null && v > 0.02);
  published.sort((x, y) => x - y);
  const pubMed = published[Math.floor(published.length / 2)] ?? 0;
  const rel = pubMed > 0 ? Math.abs(actualMps - pubMed) / pubMed : Infinity;
  return { actualMps, publishedMps: pubMed, rel, pass: rel < 0.2 };
}

const d1 = d1FromPost();
const g31 = { d1Flipped: d1?.pass === true, departNotStuck: d1Fixed === true, d1 };

const fsIncreased = fsRatio != null && fsRatio > 1.01;
const rebuttalNoIncrease = g34.firestore.pass && !fsIncreased;
const rebuttalOver = !g34.firestore.pass || !g34.rtdb.pass;

const allPass = g31.d1Flipped && g31.departNotStuck && acc32 && reg33 && write34;

let s3b1 = null;
try {
  s3b1 = JSON.parse(readFileSync(S3B1, "utf8"));
} catch {
  /* optional */
}

const out = {
  instruction: "S3B-2",
  newE2e: true,
  skew: { used: 0 },
  rebuttal: {
    applies: rebuttalNoIncrease || rebuttalOver,
    kind: rebuttalOver ? "write_over_1_3" : rebuttalNoIncrease ? "no_fs_increase" : null,
    note: rebuttalOver
      ? "쓰기량 1.3배 초과 — 상수 조정 금지, 수치 보고"
      : rebuttalNoIncrease
        ? "적용속도인데 FS 증가 없음 → 증폭 예측 반증. 수치 보고"
        : "반증 불성립 (FS 소폭 증가·게이트 내)",
    fsRatio,
    rtdbRatio,
  },
  uag: allPass ? "S3B-2 PASS(D-1 교정) · z15 유지" : "FAIL",
  gates: {
    d1_3_1: g31.d1Flipped && g31.departNotStuck,
    accuracy_3_2: acc32,
    regression_3_3: reg33,
    writes_3_4: write34,
    all: allPass,
  },
  g31,
  base,
  post,
  writesCompare: g34,
  s3b1Contrast: s3b1
    ? {
        depart: {
          before: s3b1.cases?.["z15-depart"]?.D_eff,
          after: post.cases["z15-depart"]?.D_eff,
          rmseBefore: s3b1.cases?.["z15-depart"]?.residualRmse,
          rmseAfter: post.cases["z15-depart"]?.residualRmse,
          maxBefore: s3b1.cases?.["z15-depart"]?.residualMax,
          maxAfter: post.cases["z15-depart"]?.residualMax,
        },
        cruise: {
          before: s3b1.cases?.["z15-cruise"]?.D_eff,
          after: post.cases["z15-cruise"]?.D_eff,
          rmseBefore: s3b1.cases?.["z15-cruise"]?.residualRmse,
          rmseAfter: post.cases["z15-cruise"]?.residualRmse,
          maxBefore: s3b1.cases?.["z15-cruise"]?.residualMax,
          maxAfter: post.cases["z15-cruise"]?.residualMax,
        },
      }
    : null,
  limits: S1_LIMITS,
};

writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      out: OUT,
      uag: out.uag,
      rebuttal: out.rebuttal,
      gates: out.gates,
      depart: post.cases["z15-depart"] && {
        D_eff: post.cases["z15-depart"].D_eff,
        RMSE: post.cases["z15-depart"].residualRmse,
        max: post.cases["z15-depart"].residualMax,
        stuck: departStuck,
      },
      cruise: post.cases["z15-cruise"] && {
        D_eff: post.cases["z15-cruise"].D_eff,
        RMSE: post.cases["z15-cruise"].residualRmse,
        max: post.cases["z15-cruise"].residualMax,
      },
      writes: { rtdbRatio, fsRatio, fsDepartRatio, fsCruiseRatio },
      d1,
    },
    null,
    2,
  ),
);
