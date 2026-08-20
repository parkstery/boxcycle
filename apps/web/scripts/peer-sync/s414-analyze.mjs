/**
 * S4-14 — 캡처 프레임에서 처음 이상해지는 단계를 고른다.
 * 픽셀 군집 없음. DOM translate 와 distM 시계열만.
 *
 *   cd apps/web && node scripts/peer-sync/s414-analyze.mjs [S414-chain.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELAY = resolve(HERE, "../../../../document/ops/sync-relay");

const EPS_M = 0.02;
const EPS_CAM_DEG = 0.15;
const EPS_PX = 1.5;
const REL_REVERSE_PX = 4;

function argPath() {
  const a = process.argv[2];
  return a ? resolve(process.cwd(), a) : resolve(RELAY, "S414-chain.json");
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

function peerSeries(frames, pick) {
  const out = [];
  for (const f of frames) {
    const p = f.peers?.[0];
    out.push(p ? pick(p) : null);
  }
  return out;
}

function analyzeRun(run) {
  const frames = run.frames ?? [];
  const local = frames.map((f) => f.localDistM);
  const newestDist = peerSeries(frames, (p) => p.newestDistM);
  const newestServer = peerSeries(frames, (p) => p.newestServerAtMs);
  const display = peerSeries(frames, (p) => p.displayDistM);
  const camB = frames.map((f) => f.camBearing);
  const camLng = frames.map((f) => f.camLng);
  const selfX = frames.map((f) => f.selfAnchor?.x ?? null);
  const selfY = frames.map((f) => f.selfAnchor?.y ?? null);
  const peerX = peerSeries(frames, (p) => p.peerAnchor?.x ?? null);
  const peerY = peerSeries(frames, (p) => p.peerAnchor?.y ?? null);
  const relX = peerSeries(frames, (p) => p.relX);
  const relY = peerSeries(frames, (p) => p.relY);

  const num = (xs) => xs.filter((v) => typeof v === "number" && Number.isFinite(v));

  const s1 = monotonic(num(local), EPS_M);
  const s2d = monotonic(num(newestDist), EPS_M);
  const s2t = monotonic(num(newestServer), 0);
  const s3 = reversals(num(display), EPS_M);
  const s3back = monotonic(num(display), EPS_M);
  const s4b = reversals(num(camB), EPS_CAM_DEG);
  const s4c = reversals(num(camLng), 1e-7);
  const s6x = reversals(num(selfX), EPS_PX);
  const s6y = reversals(num(selfY), EPS_PX);
  const s5x = reversals(num(peerX), EPS_PX);
  const s5y = reversals(num(peerY), EPS_PX);
  const s7x = reversals(num(relX), REL_REVERSE_PX);
  const s7y = reversals(num(relY), REL_REVERSE_PX);

  const sentinel =
    frames.length > 0 &&
    frames.every(
      (f) =>
        f.localDistM === 0 &&
        f.camLng === 0 &&
        (f.selfAnchor == null || (f.selfAnchor.x === 0 && f.selfAnchor.y === 0)),
    );

  const stages = [
    { id: "1-local", dirty: s1.back > 0, detail: s1 },
    { id: "2-packet", dirty: s2d.back > 0 || s2t.back > 0, detail: { dist: s2d, serverAt: s2t } },
    { id: "3-displayDistM", dirty: s3back.maxBack > 0.05 || s3.n > 0, detail: { rev: s3, back: s3back } },
    {
      id: "4-camera",
      dirty: s4b.peakToPeak > 2 || s4c.n > 8,
      detail: { bearing: s4b, lng: s4c },
    },
    {
      id: "5-peerDom",
      dirty: s5x.n + s5y.n > 0 && s5x.maxMag + s5y.maxMag > 8,
      detail: { x: s5x, y: s5y },
    },
    {
      id: "6-selfDom",
      dirty: s6x.n + s6y.n > 0 && s6x.peakToPeak + s6y.peakToPeak > 20,
      detail: { x: s6x, y: s6y },
    },
    {
      id: "7-relAnchor",
      dirty: s7x.n + s7y.n > 0,
      detail: { x: s7x, y: s7y },
    },
  ];
  const first = stages.find((s) => s.dirty) ?? null;

  return {
    conditionId: run.conditionId,
    n: frames.length,
    dtMs:
      frames.length > 1 ? (frames[frames.length - 1].perfNowMs - frames[0].perfNowMs) / (frames.length - 1) : null,
    sentinelZero: sentinel,
    local: s1,
    packetDist: s2d,
    packetServer: s2t,
    display: { ...s3, ...s3back },
    camera: { bearing: s4b, lng: s4c },
    peerDom: { x: s5x, y: s5y },
    selfDom: { x: s6x, y: s6y },
    relAnchor: { x: s7x, y: s7y },
    firstDirty: first?.id ?? null,
    stages,
  };
}

function relAnchorFails(analysis) {
  return (analysis.relAnchor?.x?.n ?? 0) + (analysis.relAnchor?.y?.n ?? 0) > 0;
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
const pair = analyses.find((a) => a.conditionId && String(a.conditionId).includes("pair"));
const solo = analyses.find((a) => a.conditionId && String(a.conditionId).includes("solo"));

const summary = {
  instruction: "S4-14",
  source: path,
  c0: dump.clockCanonical === "performance.now" && dump.sameRaf === true,
  c2: dump.pixelAnalysis === false,
  analyses,
  firstDirtyPair: pair?.firstDirty ?? analyses[0]?.firstDirty ?? null,
  soloLooksSmooth: solo
    ? solo.local.back === 0 && (solo.selfDom.x.peakToPeak ?? 0) < 30 && (solo.selfDom.y.peakToPeak ?? 0) < 30
    : null,
  relAnchorFail: pair ? relAnchorFails(pair) : analyses.some(relAnchorFails),
};

const out = resolve(RELAY, "S414-summary.json");
writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ firstDirtyPair: summary.firstDirtyPair, soloLooksSmooth: summary.soloLooksSmooth, relAnchorFail: summary.relAnchorFail, n: analyses.map((a) => ({ id: a.conditionId, n: a.n })) }, null, 2));
