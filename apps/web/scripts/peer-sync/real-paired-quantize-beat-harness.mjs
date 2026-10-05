/**
 * 합성 등속 dual — wire 거리 양자 비트의 인과적 기여 (제품 encode/self/Registry).
 *
 * IMPORTANT: 원본 paired JSON 을 읽지 않는다. 실측 관찰과 분리된 합성 재현이다.
 * 원본 반올림 전 거리는 복구 불가. BEFORE=0.1m / AFTER=제품 0.01m.
 *
 *   cd apps/web && node scripts/peer-sync/real-paired-quantize-beat-harness.mjs
 *   cd apps/web && node scripts/peer-sync/real-paired-quantize-beat-harness.mjs --graph
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { performance } from "node:perf_hooks";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const OPS_DIR = resolve(WEB_ROOT, "../../document/ops/20261005-peer-spacing-jitter");
const EVIDENCE = resolve(OPS_DIR, "evidence/real-paired-20261005");
const GRAPH_DIR = resolve(EVIDENCE, "graphs");

const WALL = 1_700_000_000_000;
const STEP_MS = 1000 / 60;
const RUN_MS = 8_000;
const WARM_MS = 2_000;
const PUB_MS = 200;
const RTT_MS = 140;
const HARD_MS = 120_000;
const PUB = "pub-quantize-beat";
const PEER = "peer-B";

const PHASES_MS = [0, 40, 80, 120, 160];
const SPEEDS_KMH = [5, 6, 20];

const wantGraph = process.argv.includes("--graph");

function pct(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

function stats(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return {
    n: arr.length,
    min: s[0],
    p50: pct(arr, 0.5),
    p90: pct(arr, 0.9),
    max: s[s.length - 1],
    mean: arr.reduce((a, b) => a + b, 0) / arr.length,
    pp: s[s.length - 1] - s[0],
  };
}

async function loadMods(vite) {
  return {
    clock: await vite.ssrLoadModule("/src/lib/peerMotion/repo/serverClockOffset.ts"),
    disp: await vite.ssrLoadModule("/src/lib/peerMotion/commonDisplayClock.ts"),
    selfBuf: await vite.ssrLoadModule("/src/lib/peerMotion/selfDisplayBuffer.ts"),
    registryMod: await vite.ssrLoadModule("/src/lib/peerMotion/PeerMotionRegistry.ts"),
    encode: await vite.ssrLoadModule("/src/lib/peerMotion/repo/rtdbTrailMotion.ts"),
    quant: await vite.ssrLoadModule("/src/lib/peerMotion/motionWireQuantize.ts"),
    rtdbToPacket: await vite.ssrLoadModule("/src/lib/peerMotion/rtdbToPacket.ts"),
  };
}

async function runOnce(vite, quantumM, label, opts = {}) {
  const phaseMs = opts.phaseMs ?? 80;
  const speedKmh = opts.speedKmh ?? 5;
  const V = speedKmh / 3.6;
  const m = await loadMods(vite);
  m.quant.__setMotionWireDistQuantumForTests(quantumM);

  m.clock.__resetServerClockOffsetForTests();
  m.clock.__setServerTimeOffsetForTests(0, { ready: true, uncertain: false });
  m.disp.resetCommonDisplayClock();
  m.selfBuf.resetSelfDisplayBuffer();
  m.registryMod.resetPeerMotionRegistry?.();
  m.disp.setCompanionDisplayActive(true);

  const reg = m.registryMod.getPeerMotionRegistry
    ? m.registryMod.getPeerMotionRegistry()
    : new m.registryMod.PeerMotionRegistry();

  const gaps = [];
  const gapSeries = [];
  const pending = [];
  let nextSelf = 0;
  let nextPeer = phaseMs;
  let activeNow = WALL;
  const realNow = Date.now.bind(Date);
  Date.now = () => activeNow;

  try {
    for (let t = 0; t <= RUN_MS; t += STEP_MS) {
      const wall = WALL + t;
      activeNow = wall;

      while (nextSelf <= t) {
        const dist = 100 + V * (nextSelf / 1000);
        const pubWall = WALL + nextSelf;
        activeNow = pubWall;
        const pay = m.encode.encodePayload({
          publicationId: PUB,
          distM: dist,
          speedMps: V,
          ridePhase: "live",
          tSrv: pubWall,
        });
        m.selfBuf.pushSelfDisplaySample({
          tSrv: pubWall,
          distM: pay.d,
          speedMps: pay.v,
        });
        nextSelf += PUB_MS;
        activeNow = wall;
      }

      while (nextPeer <= t) {
        const dist = 99.73 + V * (nextPeer / 1000);
        const pubWall = WALL + nextPeer;
        activeNow = pubWall;
        const pay = m.encode.encodePayload({
          publicationId: PUB,
          distM: dist,
          speedMps: V,
          ridePhase: "live",
          tSrv: pubWall,
        });
        pending.push({ at: nextPeer + RTT_MS, pay, pubWall });
        nextPeer += PUB_MS;
        activeNow = wall;
      }

      for (let i = pending.length - 1; i >= 0; i--) {
        if (pending[i].at > t) continue;
        const ev = pending.splice(i, 1)[0];
        activeNow = wall;
        const row = m.encode.decodeTrailMotionPayload(PEER, ev.pay);
        row.serverAtMs = wall;
        const packet = m.rtdbToPacket.rtdbMotionRowToPeerMotionPacket(row, PUB);
        reg.ingest(packet, "peer", wall);
      }

      m.disp.ensureFrameDisplayRenderTimeMs(wall);
      reg.step(STEP_MS / 1000, null, wall);
      const rt = m.disp.peekFrameDisplayRenderTimeMs();
      const self = rt != null ? m.selfBuf.sampleSelfDisplayDistM(rt) : null;
      const peer = reg.getRawDisplayDistM(PEER);
      if (t >= WARM_MS && self != null && peer != null) {
        const gap = peer - self;
        gaps.push(gap);
        gapSeries.push({ t, gap, peer, self });
      }
    }
  } finally {
    Date.now = realNow;
    m.quant.__setMotionWireDistQuantumForTests(null);
  }

  const pps = [];
  for (let w = WARM_MS; w + 1000 <= RUN_MS; w += 1000) {
    const slice = gapSeries.filter((g) => g.t >= w && g.t < w + 1000).map((g) => g.gap);
    if (slice.length >= 10) pps.push(Math.max(...slice) - Math.min(...slice));
  }

  return {
    label,
    quantumM: quantumM ?? m.quant.MOTION_WIRE_DIST_QUANTUM_M,
    productQuantumExport: m.quant.MOTION_WIRE_DIST_QUANTUM_M,
    phaseMs,
    speedKmh,
    pubMs: PUB_MS,
    gap: stats(gaps),
    gapPp1s: stats(pps),
    gapSeries,
    sample: gapSeries.filter((_, i) => i % 40 === 0).slice(0, 8),
  };
}

/** 동일 표본·송신 횟수로 encodePayload JSON UTF-8 바이트 (전송 overhead 제외) */
async function measureEncodeBytes(vite) {
  const m = await loadMods(vite);
  const samples = [];
  const V = 5 / 3.6;
  const N = 500; // 5Hz × 100s 상당 표본 집합
  for (let i = 0; i < N; i++) {
    samples.push({
      publicationId: "pub-byte-measure",
      distM: 100 + V * (i * 0.2),
      speedMps: V,
      ridePhase: "live",
      tSrv: WALL + i * 200,
    });
  }

  function measure(quantumM) {
    m.quant.__setMotionWireDistQuantumForTests(quantumM);
    const realNow = Date.now.bind(Date);
    Date.now = () => WALL;
    try {
      const sizes = samples.map((s) => {
        const pay = m.encode.encodePayload(s);
        return Buffer.byteLength(JSON.stringify(pay), "utf8");
      });
      const sum = sizes.reduce((a, b) => a + b, 0);
      return {
        quantumM: quantumM ?? m.quant.MOTION_WIRE_DIST_QUANTUM_M,
        n: sizes.length,
        meanBytes: sum / sizes.length,
        maxBytes: Math.max(...sizes),
        minBytes: Math.min(...sizes),
        totalBytes: sum,
      };
    } finally {
      Date.now = realNow;
      m.quant.__setMotionWireDistQuantumForTests(null);
    }
  }

  const before = measure(0.1);
  const after = measure(null); // product 0.01
  const meanDelta = after.meanBytes - before.meanBytes;
  const maxDelta = after.maxBytes - before.maxBytes;
  // 5 publish/s · 1 rider · 3600s — payload JSON only
  const perHourIncremental = meanDelta * 5 * 3600;
  return {
    note: "JSON.stringify(encodePayload) UTF-8; no RTDB/transport overhead. Same N samples, publish cadence unchanged (5Hz).",
    publishHz: 5,
    sampleCount: N,
    before0_1m: before,
    afterProduct0_01m: after,
    meanDeltaBytes: meanDelta,
    maxDeltaBytes: maxDelta,
    oneRiderPerHourIncrementalBytes: perHourIncremental,
    cadenceUnchanged: true,
  };
}

function buildGapCompareSvg(beforeSeries, afterSeries, title) {
  const W = 900;
  const H = 280;
  const PAD = { l: 56, r: 16, t: 28, b: 36 };
  const all = [...beforeSeries, ...afterSeries];
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const gaps = all.map((p) => p.gap);
  let gMin = Math.min(...gaps);
  let gMax = Math.max(...gaps);
  if (gMax - gMin < 1e-6) {
    gMin -= 0.05;
    gMax += 0.05;
  }
  const x = (t) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (g) => PAD.t + ((gMax - g) / (gMax - gMin)) * (H - PAD.t - PAD.b);
  const poly = (series, color) => {
    const pts = series
      .map((p) => `${x(p.t).toFixed(1)},${y(p.gap).toFixed(1)}`)
      .join(" ");
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.2"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0b0e13"/>
  <text x="${PAD.l}" y="18" fill="#e6edf3" font-size="12" font-family="monospace">${title}</text>
  <text x="${PAD.l}" y="${H - 8}" fill="#6b7480" font-size="10" font-family="monospace">t(ms)  red=0.1m quantum  cyan=0.01m product  y=relativeGapM</text>
  <line x1="${PAD.l}" y1="${H - PAD.b}" x2="${W - PAD.r}" y2="${H - PAD.b}" stroke="#2b3341"/>
  <line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${H - PAD.b}" stroke="#2b3341"/>
  <text x="4" y="${PAD.t + 4}" fill="#6b7480" font-size="9" font-family="monospace">${gMax.toFixed(3)}</text>
  <text x="4" y="${H - PAD.b}" fill="#6b7480" font-size="9" font-family="monospace">${gMin.toFixed(3)}</text>
  ${poly(beforeSeries, "#ff6b6b")}
  ${poly(afterSeries, "#4ecdc4")}
</svg>`;
}

function buildObservedGapSvg(points, title) {
  const W = 900;
  const H = 240;
  const PAD = { l: 56, r: 16, t: 28, b: 36 };
  if (!points.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="20" y="40" fill="#e6edf3">no observed points</text></svg>`;
  }
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const gaps = points.map((p) => p.gap);
  let gMin = Math.min(...gaps);
  let gMax = Math.max(...gaps);
  if (gMax - gMin < 1e-6) {
    gMin -= 0.05;
    gMax += 0.05;
  }
  const x = (t) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (g) => PAD.t + ((gMax - g) / (gMax - gMin)) * (H - PAD.t - PAD.b);
  const pts = points.map((p) => `${x(p.t).toFixed(1)},${y(p.gap).toFixed(1)}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0b0e13"/>
  <text x="${PAD.l}" y="18" fill="#e6edf3" font-size="12" font-family="monospace">${title}</text>
  <text x="${PAD.l}" y="${H - 8}" fill="#6b7480" font-size="10" font-family="monospace">observed running relativeGapM (not a wire-file replay)</text>
  <line x1="${PAD.l}" y1="${H - PAD.b}" x2="${W - PAD.r}" y2="${H - PAD.b}" stroke="#2b3341"/>
  <line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${H - PAD.b}" stroke="#2b3341"/>
  <polyline points="${pts}" fill="none" stroke="#f0c674" stroke-width="1.2"/>
</svg>`;
}

/** 실측 rider JSON 에서 running 상대간격 시계열 추출 (관찰용 — harness 입력 아님) */
function loadObservedGapSeries() {
  const pathA = resolve(EVIDENCE, "rider_A.json");
  if (!existsSync(pathA)) return null;
  const a = JSON.parse(readFileSync(pathA, "utf8"));
  const frames = (a.frames || []).filter(
    (f) => typeof f.relativeGapM === "number" && Number.isFinite(f.relativeGapM),
  );
  if (frames.length < 10) return null;
  const t0 = frames[0].atMs;
  return frames.map((f) => ({ t: f.atMs - t0, gap: f.relativeGapM }));
}

async function main() {
  const started = performance.now();
  const vite = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    if (performance.now() - started > HARD_MS) throw new Error("hard timeout");

    const byteCost = await measureEncodeBytes(vite);

    const after = await runOnce(vite, null, "AFTER_product", { phaseMs: 80, speedKmh: 5 });
    const before = await runOnce(vite, 0.1, "BEFORE_0.1", { phaseMs: 80, speedKmh: 5 });

    const beforePp = before.gapPp1s?.mean ?? before.gap?.pp ?? 0;
    const afterPp = after.gapPp1s?.mean ?? after.gap?.pp ?? 0;
    const passPrimary =
      beforePp >= 0.04 && afterPp <= 0.025 && afterPp < beforePp * 0.55;

    // phase × speed 행렬 — 0.01m 가 악화하지 않는지 (임계 완화 금지)
    const matrix = [];
    let matrixPass = true;
    for (const speedKmh of SPEEDS_KMH) {
      for (const phaseMs of PHASES_MS) {
        const b = await runOnce(vite, 0.1, `B_${speedKmh}_${phaseMs}`, { phaseMs, speedKmh });
        const a = await runOnce(vite, null, `A_${speedKmh}_${phaseMs}`, { phaseMs, speedKmh });
        const bPp = b.gapPp1s?.mean ?? b.gap?.pp ?? 0;
        const aPp = a.gapPp1s?.mean ?? a.gap?.pp ?? 0;
        // 악화 금지(절대 상한은 primary 5km/h 게이트만). float eps 만 허용 — 임계 완화 금지.
        const ok = aPp <= bPp + 1e-9;
        if (!ok) matrixPass = false;
        matrix.push({
          speedKmh,
          phaseMs,
          beforeMean1sPp: bPp,
          afterMean1sPp: aPp,
          ok,
        });
      }
    }

    const pass = passPrimary && matrixPass;

    const observed = loadObservedGapSeries();

    mkdirSync(EVIDENCE, { recursive: true });
    mkdirSync(GRAPH_DIR, { recursive: true });

    const seriesOut = {
      kind: "synthetic-equal-speed-dual",
      note: "Not a replay of rider_*.json. Causal evidence for wire distance quantum only.",
      before: before.gapSeries,
      after: after.gapSeries,
    };
    writeFileSync(
      resolve(EVIDENCE, "quantize-beat-gap-series.json"),
      JSON.stringify(seriesOut),
    );
    if (observed) {
      writeFileSync(
        resolve(EVIDENCE, "observed-running-gap-series.json"),
        JSON.stringify({
          kind: "observed-from-rider_A-frames",
          note: "Real capture relativeGapM timeseries for graph compare. Not harness input.",
          points: observed,
        }),
      );
    }

    if (wantGraph) {
      const { svgToPng } = await import("./graph.mjs");
      const synthSvg = buildGapCompareSvg(
        before.gapSeries,
        after.gapSeries,
        "synthetic relativeGap  before0.1(red) vs after0.01(cyan)  phase80 5km/h",
      );
      writeFileSync(resolve(GRAPH_DIR, "quantize-beat-synthetic-compare.svg"), synthSvg);
      await svgToPng(synthSvg, resolve(GRAPH_DIR, "quantize-beat-synthetic-compare.png"));
      if (observed) {
        const obsSvg = buildObservedGapSvg(
          observed,
          "observed rider_A relativeGapM (running frames)",
        );
        writeFileSync(resolve(GRAPH_DIR, "observed-running-gap.svg"), obsSvg);
        await svgToPng(obsSvg, resolve(GRAPH_DIR, "observed-running-gap.png"));
      }
    }

    const out = {
      generatedAt: new Date().toISOString(),
      evidenceKind: "synthetic-equal-speed-product-path",
      note:
        "Equal-speed dual synthetic (PUB200, RTT140, D600). Does NOT read original paired JSON. Separates observed symptom from causal quantum contribution. Pre-round-trip distances irrecoverable from wire files.",
      publishCadenceMs: PUB_MS,
      before: { ...before, gapSeries: undefined },
      after: { ...after, gapSeries: undefined },
      compare: {
        beforeMean1sPp: beforePp,
        afterMean1sPp: afterPp,
        reduction: beforePp > 0 ? 1 - afterPp / beforePp : null,
      },
      matrix: { phasesMs: PHASES_MS, speedsKmh: SPEEDS_KMH, rows: matrix, pass: matrixPass },
      encodeByteCost: byteCost,
      pass,
      passPrimary,
      graphWritten: wantGraph,
    };

    writeFileSync(resolve(EVIDENCE, "quantize-beat-metrics.json"), JSON.stringify(out, null, 2));
    writeFileSync(resolve(OPS_DIR, "quantize-beat-metrics.json"), JSON.stringify(out, null, 2));
    writeFileSync(
      resolve(EVIDENCE, "encode-payload-byte-cost.json"),
      JSON.stringify(byteCost, null, 2),
    );

    console.log(JSON.stringify({ compare: out.compare, matrixPass, byteCost: {
      meanDeltaBytes: byteCost.meanDeltaBytes,
      maxDeltaBytes: byteCost.maxDeltaBytes,
      oneRiderPerHourIncrementalBytes: byteCost.oneRiderPerHourIncrementalBytes,
    } }, null, 2));
    console.log(pass ? "PASS" : "FAIL", "before", beforePp.toFixed(4), "after", afterPp.toFixed(4));
    console.log("wallMs", Math.round(performance.now() - started));
    process.exit(pass ? 0 : 1);
  } finally {
    await vite.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
