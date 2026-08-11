/**
 * S3-DIAG-R2 — S3R-chain-events.json → S3R-summary.json
 *   node scripts/peer-sync/s3r-summarize.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../../../../document/ops/sync-relay");
const EVENTS = resolve(DIR, "S3R-chain-events.json");
const OUT = resolve(DIR, "S3R-summary.json");

const METRICS_UI_S = 0.2;
const ROUND_M = 0.05;
const INTERP_DELAY_MS = 160;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function stats(arr) {
  const a = arr.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return { n: 0, p50: null, p95: null, max: null, over1s: null };
  const at = (p) => a[Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1))];
  return {
    n: a.length,
    p50: at(0.5),
    p95: at(0.95),
    max: a[a.length - 1],
    over1s: a.filter((x) => x > 1000).length / a.length,
  };
}

function withM(msStats, speedMps) {
  const toM = (ms) => (ms == null || !Number.isFinite(speedMps) ? null : (speedMps * ms) / 1000);
  return { ...msStats, speedMpsUsed: speedMps, p50_m: toM(msStats.p50), p95_m: toM(msStats.p95), max_m: toM(msStats.max) };
}

const raw = JSON.parse(readFileSync(EVENTS, "utf8"));
const events = raw.events;
const skewMs = raw.clockSkewMs;
const publisherUid = raw.publisherUid;

const a = events.filter((e) => e.side === "A");
const b = events.filter((e) => e.side === "B");

const bySeqA = new Map();
for (const e of a) {
  if (e.seq == null) continue;
  const slot = bySeqA.get(e.seq) ?? {};
  slot[`pt${e.pt}`] = e;
  bySeqA.set(e.seq, slot);
}

const firstPt4 = [];
const repeatPt4 = [];
for (const e of b.filter((x) => x.pt === 4)) {
  if (publisherUid && e.uid && e.uid !== publisherUid) continue;
  if (num(e.first) === 1) firstPt4.push(e);
  else repeatPt4.push(e);
}

const pt5 = b.filter((e) => e.pt === 5 && (!publisherUid || !e.uid || e.uid === publisherUid));
const pt6 = b.filter((e) => e.pt === 6);
const pt7 = b.filter((e) => e.pt === 7);

// speed from A appliedKmh (not published v)
const applied = a
  .filter((e) => e.pt === 1)
  .map((e) => num(e.appliedKmh))
  .filter((x) => x != null && x > 0.1);
applied.sort((x, y) => x - y);
const cruiseKmh = applied.length ? applied[Math.floor(applied.length * 0.75)] : 30;
const speedMps = cruiseKmh / 3.6;

// §2-2 ①→②
const d12 = [];
for (const e of a.filter((x) => x.pt === 1)) {
  const auth = num(e.authDist);
  const snap = num(e.snapshotDist);
  const appliedKmh = num(e.appliedKmh);
  if (auth == null || snap == null || appliedKmh == null || !Number.isFinite(appliedKmh)) continue;
  const measured = Math.abs(auth - snap);
  const expected = METRICS_UI_S * (Math.max(0, appliedKmh) / 3.6);
  d12.push({ seq: e.seq, measured, expected, excess: measured - expected, appliedKmh });
}

// ②→③
const d23 = [];
for (const [seq, slot] of bySeqA) {
  const d2 = num(slot.pt2?.dist);
  const d3 = num(slot.pt3?.d);
  if (d2 == null || d3 == null) continue;
  const measured = Math.abs(d2 - d3);
  d23.push({ seq, measured, expected: ROUND_M, excess: Math.max(0, measured - ROUND_M) });
}

const publishQueue = a.filter((e) => e.pt === 3).map((e) => num(e.publishQueueMs)).filter((x) => x != null);
const writeRtt = a.filter((e) => e.pt === 3).map((e) => num(e.writeRttMs)).filter((x) => x != null);
const inFlightMax = Math.max(0, ...a.filter((e) => e.pt === 3).map((e) => num(e.inFlightMax) ?? 0));

const endToEnd = [];
const receiveVsAck = [];
const writeBySeq = new Map(a.filter((e) => e.pt === 3).map((e) => [e.seq, e]));
for (const e of firstPt4) {
  const w = writeBySeq.get(e.seq);
  if (!w) continue;
  const start = num(w.writeStart);
  const done = num(w.writeDone);
  const seen = num(e.firstSeenAt) ?? num(e.recvAt);
  if (start == null || seen == null || skewMs == null) continue;
  endToEnd.push(seen - skewMs - start);
  if (done != null) receiveVsAck.push(seen - skewMs - done);
}

// ④→⑤ discard
const discard = { sameDist: 0, forward: 0, retrograde: 0, accepted: 0 };
for (const e of pt5) {
  const r = e.result;
  if (r === "dup-same-dist") discard.sameDist += 1;
  else if (r === "discard-forward") discard.forward += 1;
  else if (r === "discard-retrograde") discard.retrograde += 1;
  else if (r === "accepted") discard.accepted += 1;
}

const firstPt4ByKey = new Map(firstPt4.map((e) => [`${e.uid}:${e.seq}`, e]));
const retro = pt5.filter((e) => e.result === "discard-retrograde");
const retroA = [];
const retroB = [];
const retroC = [];
for (const e of retro) {
  if (num(e.seq) == null) {
    retroC.push(e);
    continue;
  }
  const key = `${e.uid}:${e.seq}`;
  const first4 = firstPt4ByKey.get(key);
  const matchingRepeats = repeatPt4.filter((p) => p.seq === e.seq && p.uid === e.uid);
  // A: 이 (uid,seq) 의 최초 관측 패킷과 같은 d 인 역행
  const sameAsFirst = first4 && Math.abs((num(first4.d) ?? NaN) - (num(e.d) ?? NaN)) <= 0.15;
  if (sameAsFirst && retroA.every((x) => `${x.uid}:${x.seq}` !== key)) {
    retroA.push(e);
  } else if (matchingRepeats.length || !sameAsFirst) {
    retroB.push(e);
  } else {
    retroC.push(e);
  }
}
const retroAuniq = retroA;
const retroBuniq = retroB;
const retroCuniq = retroC;

const lostM = retroAuniq.map((e) => {
  const newest = num(e.newest);
  const d = num(e.d);
  return newest != null && d != null ? Math.max(0, newest - d) : 0;
});

// §5 modes
const modes = { oldest: 0, interpolate: 0, extrapolate: 0, paused: 0 };
const contractErr = [];
const aheadRaw = [];
const aheadCap = [];
let capHits = 0;
const extrapErrM = [];
const modeDelayExcessM = { interpolate: [], extrapolate: [], oldest: [] };

const aAuth = a.filter((e) => e.pt === 1 && num(e.authDist) != null && num(e.capturedAt) != null)
  .map((e) => ({ t: num(e.capturedAt), d: num(e.authDist) }))
  .sort((x, y) => x.t - y.t);

function authAt(t) {
  if (!aAuth.length || t == null) return null;
  if (t < aAuth[0].t || t > aAuth[aAuth.length - 1].t) return null;
  for (let i = 1; i < aAuth.length; i++) {
    if (t <= aAuth[i].t) {
      const a0 = aAuth[i - 1];
      const a1 = aAuth[i];
      const u = (t - a0.t) / Math.max(1, a1.t - a0.t);
      return a0.d + (a1.d - a0.d) * u;
    }
  }
  return null;
}

for (const e of pt6) {
  const mode = e.mode;
  if (modes[mode] != null) modes[mode] += 1;
  const display = num(e.displayDistM);
  let expected = null;
  if (mode === "paused") {
    expected = num(e.newestDist);
  } else if (mode === "oldest") {
    expected = num(e.oldestDist);
    const delay = num(e.newestAgeMs);
    if (delay != null) modeDelayExcessM.oldest.push((speedMps * delay) / 1000);
  } else if (mode === "interpolate") {
    const s0 = num(e.s0Dist);
    const s1 = num(e.s1Dist);
    const t = num(e.t);
    if (s0 != null && s1 != null && t != null) expected = s0 + (s1 - s0) * t;
    const span = (num(e.s1Recv) ?? 0) - (num(e.s0Recv) ?? 0);
    const expectMs = INTERP_DELAY_MS + Math.max(0, span);
    // 격자 오차는 기대 안에 포함 — 초과량은 계약 오차 쪽
    modeDelayExcessM.interpolate.push(0);
    void expectMs;
  } else if (mode === "extrapolate") {
    const nd = num(e.newestDist);
    const spd = num(e.entitySpeedMps);
    const ahead = num(e.aheadMs);
    const raw = num(e.aheadMsRaw);
    if (raw != null) aheadRaw.push(raw);
    if (ahead != null) aheadCap.push(ahead);
    if (num(e.capHit) === 1) capHits += 1;
    if (nd != null && spd != null && ahead != null) expected = nd + (spd * ahead) / 1000;
    if (ahead != null) modeDelayExcessM.extrapolate.push((speedMps * ahead) / 1000);
    // 외삽 오차: 같은 창 A 실제 이동 vs 외삽 거리
    const newestRecv = num(e.newestRecv);
    if (newestRecv != null && ahead != null && nd != null) {
      const t0 = newestRecv;
      const t1 = newestRecv + ahead;
      const a0 = authAt(t0 - (skewMs ?? 0));
      const a1 = authAt(t1 - (skewMs ?? 0));
      if (a0 != null && a1 != null && expected != null) {
        extrapErrM.push(Math.abs(a1 - a0 - (expected - nd)));
      }
    }
  }
  if (display != null && expected != null) contractErr.push(display - expected);
}

const modeN = Object.values(modes).reduce((s, n) => s + n, 0) || 1;

const excess12 = d12.map((x) => x.excess);
const excess23 = d23.map((x) => x.excess);
const excess34 = endToEnd.map((ms) => (speedMps * Math.max(0, ms)) / 1000);
const excess45 = lostM;
const excess56ex = modeDelayExcessM.extrapolate;
const excess56old = modeDelayExcessM.oldest;
const excess67 = pt7.map((e) => (num(e.clamped) === 1 ? Math.abs((num(e.displayDistM) ?? 0) - (num(e.routeLen) ?? 0)) : 0));

function maxOf(label, arr, extra = {}) {
  const s = stats(arr);
  return { link: label, n: s.n, p50_m: s.p50, p95_m: s.p95, max_m: s.max, ...extra };
}

const linkTable = [
  maxOf("①→②", excess12, { unit: "m 직접", note: "§2-2 동기 레코드 − 200ms×applied" }),
  maxOf("②→③", excess23, { unit: "m 직접", note: "복사+반올림 0.05" }),
  maxOf("③→④", excess34, {
    unit: "ms→m",
    endToEndMs: stats(endToEnd),
    note: skewMs == null ? "시계 보정 없음 → 무효" : `clockSkewMs=${skewMs}`,
  }),
  maxOf("④→⑤", excess45, { unit: "m 폐기", forward: discard.forward, retrogradeFirst: retroAuniq.length }),
  maxOf("⑤→⑥ extrapolate ahead", excess56ex, { unit: "ms→m", occupancy: modes.extrapolate / modeN }),
  maxOf("⑤→⑥ oldest", excess56old, { unit: "ms→m", occupancy: modes.oldest / modeN }),
  maxOf("⑥→⑦", excess67, { unit: "m 직접", note: "같은 geometry 이면 0" }),
];

const ranked = [...linkTable].filter((x) => x.max_m != null).sort((a, b) => (b.max_m ?? 0) - (a.max_m ?? 0));

const out = {
  instruction: "S3-DIAG-R2",
  elapsedMin: raw.elapsedMin,
  clockSkewMs: skewMs,
  clockSkewBefore: raw.clockSkewBefore,
  clockSkewAfter: raw.clockSkewAfter,
  publisherUid,
  eventCounts: {
    A: a.length,
    B: b.length,
    total: events.length,
    pt: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((p) => [p, events.filter((e) => e.pt === p).length])),
  },
  speedMpsUsed: speedMps,
  cruiseKmhApprox: cruiseKmh,
  inFlightMax,
  publishQueueMs: withM(stats(publishQueue), speedMps),
  writeRttMs: withM(stats(writeRtt), speedMps),
  endToEndMs: skewMs == null ? { invalid: true, reason: "시계 보정값 없음" } : withM(stats(endToEnd), speedMps),
  receiveVsAckMs: { referenceOnly: true, ...withM(stats(receiveVsAck), speedMps) },
  link12: {
    n: d12.length,
    measured: stats(d12.map((x) => x.measured)),
    expectedP50: stats(d12.map((x) => x.expected)).p50,
    excess: stats(excess12),
  },
  link23: { n: d23.length, excess: stats(excess23) },
  discard,
  retrograde: {
    A_firstOutOfOrder: retroAuniq.length,
    B_onValueRepeat: retroBuniq.length,
    C_other: retroCuniq.length,
    C_raw: retroCuniq,
  },
  repeatSeen: stats(repeatPt4.map((e) => num(e.repeatSeenCount)).filter((x) => x != null)),
  modes: {
    counts: modes,
    occupancy: {
      oldest: modes.oldest / modeN,
      interpolate: modes.interpolate / modeN,
      extrapolate: modes.extrapolate / modeN,
      paused: modes.paused / modeN,
    },
  },
  contractErrorM: stats(contractErr),
  extrapolate: {
    aheadMsRaw: stats(aheadRaw),
    aheadMsCapped: stats(aheadCap),
    capHitRate: aheadRaw.length ? capHits / aheadRaw.length : 0,
    errorVsA_m: stats(extrapErrM),
  },
  linkTable,
  maxExcessLink: ranked[0] ?? null,
};

writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(JSON.stringify({ maxExcessLink: out.maxExcessLink, modes: out.modes.occupancy, endToEndValid: !out.endToEndMs.invalid, retrograde: out.retrograde }, null, 2));
