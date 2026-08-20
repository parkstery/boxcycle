/**
 * S4-15 — 캡처 프레임에서 ② lngLat / ③ project / ⑤ relProj / ⑥ DOM 왕복을 가른다.
 * 픽셀 군집 없음. 경로 좌표 재계산 없음.
 *
 *   cd apps/web && node scripts/peer-sync/s415-analyze.mjs [S415-chain.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELAY = resolve(HERE, "../../../../document/ops/sync-relay");

const EPS_M = 0.05;
const EPS_GEO_M = 0.8;
const EPS_PX = 4;
const CLOSE_M = 4;
const SAME_SPEED_KMH = 0.6;
const PEER_SPEED_MPS = 0.25;

function argPath() {
  const a = process.argv[2];
  return a ? resolve(process.cwd(), a) : resolve(RELAY, "S415-chain.json");
}

function reversals(values, eps) {
  let n = 0;
  let maxMag = 0;
  let first = null;
  let prev = 0;
  for (let i = 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    if (!Number.isFinite(d)) continue;
    const mag = Math.abs(d);
    if (mag > maxMag) maxMag = mag;
    if (i > 1 && prev !== 0 && Math.sign(d) !== 0 && Math.sign(d) !== Math.sign(prev) && mag > eps) {
      n += 1;
      if (first == null) first = i;
    }
    if (mag > eps) prev = d;
  }
  const finite = values.filter((v) => Number.isFinite(v));
  const ptp = finite.length ? Math.max(...finite) - Math.min(...finite) : 0;
  return { n, maxMag, peakToPeak: ptp, firstIndex: first };
}

function monotonic(values, eps) {
  let back = 0;
  let maxBack = 0;
  for (let i = 1; i < values.length; i += 1) {
    const d = values[i - 1] - values[i];
    if (d > eps) {
      back += 1;
      if (d > maxBack) maxBack = d;
    }
  }
  return { back, maxBack };
}

function haversineM(lng1, lat1, lng2, lat2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

function gapStats(values) {
  const xs = values.filter((v) => typeof v === "number" && Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!xs.length) return { n: 0, min: null, max: null, median: null };
  return { n: xs.length, min: xs[0], max: xs[xs.length - 1], median: quantile(xs, 0.5) };
}

function peerSeries(frames, pick) {
  return frames.map((f) => {
    const p = f.peers?.[0];
    return p ? pick(p) : null;
  });
}

function num(xs) {
  return xs.filter((v) => typeof v === "number" && Number.isFinite(v));
}

/** displayDistM 이 전진인데 지리 스텝이 그와 어긋나면 ② 왕복. 도로 곡선(한 축 부호 반전)은 아님. */
function geoVsDisplay(frames) {
  let n = 0;
  let maxMag = 0;
  let first = null;
  for (let i = 1; i < frames.length; i += 1) {
    const a = frames[i - 1]?.peers?.[0];
    const b = frames[i]?.peers?.[0];
    if (!a || !b) continue;
    if (a.lng == null || a.lat == null || b.lng == null || b.lat == null) continue;
    const dDisp = b.displayDistM - a.displayDistM;
    if (!Number.isFinite(dDisp)) continue;
    const geo = haversineM(a.lng, a.lat, b.lng, b.lat);
    const resid = geo - Math.abs(dDisp);
    if (resid > maxMag) maxMag = resid;
    if (resid > EPS_GEO_M) {
      n += 1;
      if (first == null) first = i;
    }
  }
  return { n, maxMag, firstIndex: first };
}

function selfGeoVsLocal(frames) {
  let n = 0;
  let maxMag = 0;
  let first = null;
  for (let i = 1; i < frames.length; i += 1) {
    const a = frames[i - 1];
    const b = frames[i];
    if (a.selfLng == null || a.selfLat == null || b.selfLng == null || b.selfLat == null) continue;
    const dDisp = b.localDistM - a.localDistM;
    if (!Number.isFinite(dDisp)) continue;
    const geo = haversineM(a.selfLng, a.selfLat, b.selfLng, b.selfLat);
    const resid = geo - Math.abs(dDisp);
    if (resid > maxMag) maxMag = resid;
    if (resid > EPS_GEO_M) {
      n += 1;
      if (first == null) first = i;
    }
  }
  return { n, maxMag, firstIndex: first };
}

function dirtyPx(rev) {
  return (rev.n ?? 0) > 0 && (rev.maxMag ?? 0) >= EPS_PX;
}

function branchOf({ geoPeer, projPeer, relProj, relDom }) {
  if (geoPeer) return "거리→좌표";
  if (projPeer) return "카메라·투영";
  if (!relProj && relDom) return "Marker DOM";
  return "미분기";
}

function analyzeRun(run) {
  const frames = run.frames ?? [];
  const display = peerSeries(frames, (p) => p.displayDistM);
  const peerLng = peerSeries(frames, (p) => p.lng);
  const peerLat = peerSeries(frames, (p) => p.lat);
  const peerProjX = peerSeries(frames, (p) => p.projX);
  const peerProjY = peerSeries(frames, (p) => p.projY);
  const relProjX = peerSeries(frames, (p) => p.relProjX);
  const relProjY = peerSeries(frames, (p) => p.relProjY);
  const relX = peerSeries(frames, (p) => p.relX);
  const relY = peerSeries(frames, (p) => p.relY);
  const selfLng = frames.map((f) => f.selfLng);
  const selfLat = frames.map((f) => f.selfLat);
  const selfProjX = frames.map((f) => f.selfProjX);
  const selfProjY = frames.map((f) => f.selfProjY);
  const gaps = frames.map((f) => f.gapDistM);
  const speeds = frames.map((f) => f.localSpeedKmh);
  const peerSpd = peerSeries(frames, (p) => p.newestSpeedMps);
  const dtMs =
    frames.length > 1 ? (frames[frames.length - 1].perfNowMs - frames[0].perfNowMs) / (frames.length - 1) : null;
  const tickWork = num(frames.map((f) => f.tickWorkMs));
  const rafMinus = num(frames.map((f) => f.rafMinusRenderMs));
  const displayMono = monotonic(num(display), EPS_M);
  const geoPeer = geoVsDisplay(frames);
  const geoSelf = selfGeoVsLocal(frames);
  const d2Peer = displayMono.maxBack < 0.05 && geoPeer.n > 0;
  const d2Self = monotonic(num(frames.map((f) => f.localDistM)), EPS_M).maxBack < 0.05 && geoSelf.n > 0;
  const projPeerX = reversals(num(peerProjX), 1.5);
  const projPeerY = reversals(num(peerProjY), 1.5);
  const projSelfX = reversals(num(selfProjX), 1.5);
  const projSelfY = reversals(num(selfProjY), 1.5);
  const relProjXr = reversals(num(relProjX), EPS_PX);
  const relProjYr = reversals(num(relProjY), EPS_PX);
  const relDomX = reversals(num(relX), EPS_PX);
  const relDomY = reversals(num(relY), EPS_PX);
  const d3Peer = dirtyPx(projPeerX) || dirtyPx(projPeerY);
  const d3Self = dirtyPx(projSelfX) || dirtyPx(projSelfY);
  const d5 = dirtyPx(relProjXr) || dirtyPx(relProjYr);
  const d6 = dirtyPx(relDomX) || dirtyPx(relDomY);
  const g = gapStats(gaps);
  const absGaps = num(gaps).map((v) => Math.abs(v));
  const absG = gapStats(absGaps);
  const closeWhole = absG.n > 0 && absG.max != null && absG.max <= CLOSE_M;
  const speedStats = gapStats(speeds);
  const peerSpeedStats = gapStats(peerSpd);
  const sameSpeed =
    speedStats.n > 0 &&
    speedStats.min != null &&
    speedStats.max != null &&
    speedStats.min >= 5 - SAME_SPEED_KMH &&
    speedStats.max <= 5 + SAME_SPEED_KMH &&
    (peerSpeedStats.n === 0 ||
      (peerSpeedStats.min >= 5 / 3.6 - PEER_SPEED_MPS && peerSpeedStats.max <= 5 / 3.6 + PEER_SPEED_MPS));

  const peerBranch = branchOf({ geoPeer: d2Peer, projPeer: d3Peer, relProj: d5, relDom: d6 });
  const selfBranch = branchOf({
    geoPeer: d2Self,
    projPeer: d3Self,
    relProj: false,
    relDom: false,
  });

  return {
    conditionId: run.conditionId,
    n: frames.length,
    dtMs,
    hz: dtMs ? 1000 / dtMs : null,
    tickWorkMs: gapStats(tickWork),
    rafMinusRenderMs: gapStats(rafMinus),
    displayMono,
    lngLat: {
      peer: { lng: reversals(num(peerLng), 1e-7), lat: reversals(num(peerLat), 1e-7), vsDisplay: geoPeer, dirty: d2Peer },
      self: { lng: reversals(num(selfLng), 1e-7), lat: reversals(num(selfLat), 1e-7), vsLocal: geoSelf, dirty: d2Self },
    },
    projected: {
      peer: { x: projPeerX, y: projPeerY, dirty: d3Peer },
      self: { x: projSelfX, y: projSelfY, dirty: d3Self },
    },
    relProjected: { x: relProjXr, y: relProjYr, dirty: d5 },
    relDom: { x: relDomX, y: relDomY, dirty: d6 },
    gapDistM: g,
    absGapDistM: absG,
    closeWholeWindow: closeWhole,
    localSpeedKmh: speedStats,
    peerNewestSpeedMps: peerSpeedStats,
    sameSpeedWindow: sameSpeed,
    branchPeer: peerBranch,
    branchSelf: selfBranch,
  };
}

const path = argPath();
let dump;
try {
  dump = JSON.parse(readFileSync(path, "utf8"));
} catch {
  console.error(`없음: ${path}`);
  process.exit(2);
}

const runs = dump.runs ? dump.runs : [{ conditionId: dump.conditionId, frames: dump.frames }];
const analyses = runs.map((r) => analyzeRun(r));
const pair = analyses.find((a) => a.conditionId && String(a.conditionId).includes("pair")) ?? analyses[0];

const d2Hz = pair?.hz ?? null;
const d2Ok = d2Hz != null && d2Hz >= 50;
const d3Ok = Boolean(pair?.closeWholeWindow && pair?.sameSpeedWindow);

const summary = {
  instruction: "S4-15",
  source: path,
  kind: "fail-trace-not-replay",
  d0: dump.clockCanonical === "performance.now" && dump.sameRaf === true,
  d1: dump.lngLatSource === "render-setLngLat",
  d2: {
    ok: d2Ok,
    hz: d2Hz,
    dtMs: pair?.dtMs ?? null,
    tickKind: dump.tickKind ?? pair ? "requestAnimationFrame" : null,
    reason: d2Ok
      ? null
      : "예약은 MapView requestAnimationFrame 이나 e2e 2-browser + Mapbox tickBody 비용으로 프레임 시간이 길다",
  },
  d3: {
    ok: d3Ok,
    closeM: CLOSE_M,
    gap: pair?.gapDistM ?? null,
    absGap: pair?.absGapDistM ?? null,
    closeWholeWindow: pair?.closeWholeWindow ?? null,
    sameSpeedWindow: pair?.sameSpeedWindow ?? null,
    localSpeedKmh: pair?.localSpeedKmh ?? null,
    peerNewestSpeedMps: pair?.peerNewestSpeedMps ?? null,
    alignedFlag: dump.aligned ?? null,
  },
  analyses,
  branchPeer: pair?.branchPeer ?? null,
  branchSelf: pair?.branchSelf ?? null,
};

const out = resolve(RELAY, "S415-summary.json");
writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify(
    {
      d2Hz: summary.d2.hz,
      d2Ok: summary.d2.ok,
      d3Ok: summary.d3.ok,
      absGap: summary.d3.absGap,
      branchPeer: summary.branchPeer,
      branchSelf: summary.branchSelf,
      n: analyses.map((a) => ({ id: a.conditionId, n: a.n, hz: a.hz })),
    },
    null,
    2,
  ),
);
