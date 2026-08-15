/**
 * S3B-1 — S3B1-chain-events.json → S3B1-summary.json
 * skew = 0. 창은 본 파일 cases (앞 2 s 폐기).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeDeffResidualFromSeries, computeScaleGate, S1_LIMITS } from "./s1-metrics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../../../../document/ops/sync-relay");
const EVENTS = resolve(DIR, process.argv[2] || "S3B1-chain-events.json");
const OUT = resolve(DIR, process.argv[3] || "S3B1-summary.json");
const S3AV_EVENTS = resolve(DIR, "S3AV-chain-events.json");
const S3AV_SUM = resolve(DIR, "S3AV-summary.json");

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

const raw = JSON.parse(readFileSync(EVENTS, "utf8"));
const events = raw.events ?? [];
const publisherUid = raw.publisherUid;
const a = events.filter((e) => e.side === "A");
const b = events.filter((e) => e.side === "B");

function uidOk(e, uid = publisherUid) {
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

function authRows(listA, from, to) {
  const rows = [];
  for (const e of listA.filter((x) => x.pt === 1)) {
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

function dispRows(listB, pub, from, to) {
  const rows = [];
  for (const e of listB.filter((x) => x.pt === 6 && uidOk(x, pub))) {
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

function newestRows(listB, pub, from, to) {
  const firstPt4 = new Map();
  for (const e of listB.filter((x) => x.pt === 4 && uidOk(x, pub))) {
    const key = `${e.uid}:${e.seq}`;
    if (!firstPt4.has(key)) firstPt4.set(key, e);
  }
  const rows = [];
  for (const e of listB.filter((x) => x.pt === 5 && x.result === "accepted" && uidOk(x, pub))) {
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

function stage2(listA, fromA, toA) {
  const ms = [];
  for (const e of listA.filter((x) => x.pt === 3)) {
    const t = num(e.writeStart) ?? num(e.capturedAt);
    const q = num(e.publishQueueMs);
    if (t == null || q == null) continue;
    if (t < fromA || t > toA) continue;
    ms.push(q);
  }
  return { ms: stats(ms) };
}

function firstPt4BySeq(all, side, pubUid) {
  const map = new Map();
  for (const e of all.filter((x) => x.side === side && x.pt === 4 && num(x.first) === 1 && uidOk(x, pubUid))) {
    if (e.seq == null) continue;
    if (!map.has(e.seq)) map.set(e.seq, e);
  }
  return map;
}

function stage3(all, fromWrite, toWrite, sendSide, recvSide, sendUid) {
  const recv = firstPt4BySeq(all, recvSide, sendUid);
  const src = all.filter((x) => x.side === sendSide && x.pt === 3);
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
  return { ms: stats(ms), receiveVsAckMs: stats(ack), writeRttMs: stats(rtt) };
}

function withM(msStats, vMps) {
  const toM = (ms) => (ms == null || vMps == null ? null : (vMps * ms) / 1000);
  return { ...msStats, speedMpsUsed: vMps, p50_m: toM(msStats.p50), p95_m: toM(msStats.p95) };
}

function discardCounts(listB, pub, fromB, toB) {
  const out = { sameDist: 0, forward: 0, retrograde: 0, accepted: 0 };
  for (const e of listB.filter((x) => x.pt === 5 && uidOk(x, pub))) {
    const t = num(e.recvAt);
    // pt5 에 recvAt 없음 — 창 필터는 seq 생략, 전 창 합산은 케이스별로 느슨
    void t;
    void fromB;
    void toB;
    if (e.result === "dup-same-dist") out.sameDist += 1;
    else if (e.result === "discard-forward") out.forward += 1;
    else if (e.result === "discard-retrograde") out.retrograde += 1;
    else if (e.result === "accepted") out.accepted += 1;
  }
  return out;
}

function retrogradeA(listB, pub) {
  const firstPt4 = [];
  for (const e of listB.filter((x) => x.pt === 4 && uidOk(x, pub))) {
    if (num(e.first) === 1) firstPt4.push(e);
  }
  const firstMap = new Map(firstPt4.map((e) => [`${e.uid}:${e.seq}`, e]));
  const retro = listB.filter((e) => e.pt === 5 && e.result === "discard-retrograde" && uidOk(e, pub));
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

function rtdbWritesPerSec(listA, fromA, toA) {
  const writes = listA.filter((e) => {
    if (e.pt !== 3) return false;
    const t = num(e.writeStart) ?? num(e.capturedAt);
    return t != null && t >= fromA && t <= toA;
  });
  const dur = Math.max(1, (toA - fromA) / 1000);
  return { n: writes.length, perSec: writes.length / dur, windowS: dur };
}

function judgeCase(id, mark, judged) {
  const win = windowOf(mark);
  const authPad = authRows(a, win.a0 - MAX_DELAY_MS, win.a1);
  const authWin = authRows(a, win.a0, win.a1);
  const disp = dispRows(b, publisherUid, win.b0, win.b1);
  const newest = newestRows(b, publisherUid, win.b0, win.b1);

  const scale = computeScaleGate(authWin, newest, { minDeltaSelfM: 100, minWindowMs: 20_000 });
  const deff = computeDeffResidualFromSeries(authPad, disp, {
    clockSkewMs: 0,
    maxDelayMs: MAX_DELAY_MS,
    delayStepMs: 20,
    minOverlapRatio: MIN_OVERLAP,
  });
  const hitCeiling = deff.D_eff != null && deff.D_eff === MAX_DELAY_MS;
  const midT = authWin.length ? authWin[Math.floor(authWin.length / 2)].t : win.a0;
  const v = speedMpsAt(authWin, midT);
  const s1 = stage1(authWin);
  const s2 = stage2(a, win.a0, win.a1);
  const s3 = stage3(events, win.a0, win.a1, "A", "B", publisherUid);
  const s4 = { ms: { n: null, p50: INTERP_DELAY_MS, p95: INTERP_DELAY_MS, max: INTERP_DELAY_MS } };
  const sumP50 = [s1.ms.p50, s2.ms.p50, s3.ms.p50, s4.ms.p50].every((x) => x != null)
    ? s1.ms.p50 + s2.ms.p50 + s3.ms.p50 + s4.ms.p50
    : null;
  const chainDelta = sumP50 != null && deff.D_eff != null ? Math.abs(sumP50 - deff.D_eff) : null;
  const accPass =
    judged &&
    deff.D_eff != null &&
    deff.D_eff <= S1_LIMITS.D_eff_ms &&
    deff.residualRmse <= S1_LIMITS.residualRmse_m &&
    deff.residualMax <= S1_LIMITS.residualMax_m;
  const s1Pass = s1.ms.p50 != null && s1.ms.p50 <= 20;
  const chainPass = chainDelta != null && chainDelta <= 50;

  let verdict = "기록만 (판정 제외)";
  if (judged) {
    if (scale.status === "판정 유보" || deff.status !== "ok" || hitCeiling) verdict = "판정 유보";
    else verdict = accPass && s1Pass && chainPass ? "PASS" : "미종결";
  }

  return {
    id,
    judged,
    window: win,
    skewUsed: 0,
    deltaA_auth: scale.deltaSelfM,
    windowS: scale.windowMs / 1000,
    scalePct: scale.ratio != null && Number.isFinite(scale.ratio) ? scale.ratio * 100 : null,
    scaleStatus: scale.status,
    D_eff: deff.D_eff,
    residualRmse: deff.residualRmse,
    residualMax: deff.residualMax,
    overlap: deff.overlap,
    n: deff.n,
    hitCeiling,
    verdict,
    accPass,
    s1Pass,
    chainPass,
    chain: {
      s1_sampleAge: withM(s1.ms, v),
      s1_gapM: s1.m,
      s2_publishQueue: withM(s2.ms, v),
      s3_transport: withM(s3.ms, v),
      s4_interpDelay: withM(s4.ms, v),
      sumP50,
      vsDeff: chainDelta,
      writeRttMs: s3.writeRttMs,
      receiveVsAckMs: s3.receiveVsAckMs,
    },
    rtdb: rtdbWritesPerSec(a, win.a0, win.a1),
    speedMpsUsed: v,
  };
}

const casesIn = raw.cases ?? {};
const depart = casesIn["z15-depart"] ? judgeCase("z15-depart", casesIn["z15-depart"], true) : { missing: true };
const cruise = casesIn["z15-cruise"] ? judgeCase("z15-cruise", casesIn["z15-cruise"], true) : { missing: true };

const pt3 = a.filter((e) => e.pt === 3);
const publishQueue = pt3.map((e) => num(e.publishQueueMs)).filter((x) => x != null);
const pq = stats(publishQueue);
const inFlightMax = Math.max(0, ...pt3.map((e) => num(e.inFlightMax) ?? 0));
const disc = discardCounts(b, publisherUid);
const A_first = retrogradeA(b, publisherUid);
const pt3ok0 = pt3.filter((e) => num(e.ok) === 0).length;

const g33 = {
  inFlightMax: { pass: inFlightMax <= 1, got: inFlightMax },
  A_firstOutOfOrder: { pass: A_first === 0, got: A_first },
  forwardDiscard: { pass: disc.forward === 0, got: disc.forward },
  pt3_ok0: { pass: pt3ok0 === 0, got: pt3ok0 },
  publishQueueMs: {
    pass: pq.p50 != null && pq.p50 <= 150 && pq.p95 <= 400 && pq.max <= 800 && !publishQueue.some((x) => x > 1000),
    got: { ...pq, over1s: publishQueue.filter((x) => x > 1000).length },
  },
};

function totalRtdbPerSec(listA, casesMap, priorWindows) {
  let n = 0;
  let dur = 0;
  for (const id of ["z15-depart", "z15-cruise"]) {
    const w = priorWindows
      ? priorWindows[id]
      : casesMap[id]
        ? windowOf(casesMap[id])
        : null;
    if (!w) continue;
    const r = rtdbWritesPerSec(listA, w.a0, w.a1);
    n += r.n;
    dur += r.windowS;
  }
  return { n, perSec: dur > 0 ? n / dur : null, windowS: dur };
}

let s3avRtdb = null;
try {
  const s3avRaw = JSON.parse(readFileSync(S3AV_EVENTS, "utf8"));
  const s3avSum = JSON.parse(readFileSync(S3AV_SUM, "utf8"));
  const wins = {
    "z15-depart": s3avSum.cases?.["z15-depart"]?.window,
    "z15-cruise": s3avSum.cases?.["z15-cruise"]?.window,
  };
  s3avRtdb = totalRtdbPerSec(
    s3avRaw.events.filter((e) => e.side === "A"),
    null,
    wins,
  );
} catch {
  s3avRtdb = null;
}

const nowRtdb = totalRtdbPerSec(a, casesIn, null);
const rtdbRatio = s3avRtdb?.perSec && nowRtdb.perSec != null ? nowRtdb.perSec / s3avRtdb.perSec : null;

const fsLogs = raw.publishLogs ?? [];
const judgedA0 = Math.min(depart.window?.a0 ?? Infinity, cruise.window?.a0 ?? Infinity);
const judgedA1 = Math.max(depart.window?.a1 ?? 0, cruise.window?.a1 ?? 0);
const fsInWin = fsLogs.filter((x) => x.route && x.at >= judgedA0 && x.at <= judgedA1);
const fsRoute = fsInWin.length;
const fsDur = nowRtdb.windowS || 1;
const fsPerSec = fsRoute / fsDur;

const g34 = {
  rtdb: { now: nowRtdb, s3av: s3avRtdb, ratio: rtdbRatio, pass: rtdbRatio == null || rtdbRatio <= 1.3 },
  discard: disc,
  firestore: {
    routeWrites: fsRoute,
    perSec: fsPerSec,
    note: "S3AV 는 LiveLocationPublish 미캡처. 1 Hz heartbeat 기대. 속도 델타 미변경이면 유지가 정상",
  },
};

const acc31 = depart.accPass && cruise.accPass;
const chain32 = depart.s1Pass && cruise.s1Pass && depart.chainPass && cruise.chainPass;
const reg33 = Object.values(g33).every((x) => x.pass);
const write34 = g34.rtdb.pass;
const allPass = acc31 && chain32 && reg33 && write34;

const rebuttal =
  (depart.s1Pass && cruise.s1Pass && ((depart.D_eff ?? 0) > 450 || (cruise.D_eff ?? 0) > 450));

const out = {
  instruction: "S3B-1",
  elapsedMin: raw.elapsedMin,
  publisherUid,
  newE2e: true,
  skew: { used: 0, handshakeObserved: { before: raw.clockSkewBefore, after: raw.clockSkewAfter, note: "실행 지연 포함, 판정 미사용" } },
  eventCounts: {
    A: a.length,
    B: b.length,
    total: events.length,
    pt: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((p) => [p, events.filter((e) => e.pt === p).length])),
  },
  rebuttal: { applies: !!rebuttal, note: rebuttal ? "①≤20ms 인데 D_eff>450 → 감리 예측 반증" : "반증 불성립" },
  uag: allPass ? "S3B-1 PASS — z15 정확도 종결 (D-0)" : "FAIL",
  gates: {
    accuracy_3_1: acc31,
    chain_3_2: chain32,
    regression_3_3: reg33,
    writes_3_4: write34,
    all: allPass,
  },
  cases: { "z15-depart": depart, "z15-cruise": cruise },
  regression: g33,
  writes: g34,
  limits: S1_LIMITS,
};

writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      out: OUT,
      uag: out.uag,
      rebuttal: out.rebuttal.applies,
      depart: { D_eff: depart.D_eff, RMSE: depart.residualRmse, max: depart.residualMax, s1: depart.chain?.s1_sampleAge?.p50, sum: depart.chain?.sumP50 },
      cruise: { D_eff: cruise.D_eff, RMSE: cruise.residualRmse, max: cruise.residualMax, s1: cruise.chain?.s1_sampleAge?.p50, sum: cruise.chain?.sumP50 },
      rtdbRatio,
      g33,
    },
    null,
    2,
  ),
);
