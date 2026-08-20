/**
 * S4-7 — 기존 캡처 로그를 T 초로 솎아 (a) 보간+D / (b) 예측 재구성.
 * 제품 코드는 import 하지 않는다. 원본 JSON 은 읽기만 한다.
 *
 *   cd apps/web && node scripts/peer-sync/s47-experiment.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELAY = resolve(HERE, "../../../../document/ops/sync-relay");

const T_SEC = [1, 2, 4, 8];
const DELAY_FLOOR_MS = 160;
const CURRENT_BIAS_M = 0.22;
const CHIEF_GAP_M = 5;
const GATE3_MAX_ERR_M = 1.5;
const ACCEL_THRESH = 0.3;
const ADAPT_THRESH_M = [0.1, 0.3, 0.5];
const STOP_MPS = 0.15;
const MAX_EXTRAP_MS = 1200;

const LOGS = [
  { id: "S44R4", file: "S44R4-chief-5kmh.json" },
  { id: "S44R7", file: "S44R7-capture.json" },
  { id: "S45", file: "S45-after-capture.json" },
];

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

function mean(xs) {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

function ingestSamples(events) {
  const out = [];
  const seen = new Set();
  for (const e of events) {
    if (e.kind !== "ingest") continue;
    const p = e.rtdb;
    if (!p || !Number.isFinite(p.distM) || !Number.isFinite(p.speedMps)) continue;
    const t = Number.isFinite(e.atMs) ? e.atMs : p.recvAtMs;
    if (!Number.isFinite(t)) continue;
    const key = `${t}:${p.distM.toFixed(4)}:${p.speedMps.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ t, distM: p.distM, speedMps: p.speedMps });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

function displayFrames(events) {
  return events
    .filter(
      (e) =>
        e.kind === "display" &&
        Number.isFinite(e.atMs) &&
        Number.isFinite(e.displayDistM) &&
        Number.isFinite(e.localDistM),
    )
    .map((e) => ({
      atMs: e.atMs,
      peerDisplayM: e.displayDistM,
      selfM: e.localDistM,
    }));
}

/** 선형 보간. 구간 밖은 첫/마지막 샘플 홀드. 마지막 이후 MAX_EXTRAP_MS 만 속도 외삽. */
function interpAt(samples, t, { extrap = true } = {}) {
  if (!samples.length) return null;
  if (t <= samples[0].t) return samples[0].distM;
  const last = samples[samples.length - 1];
  if (t >= last.t) {
    if (!extrap) return last.distM;
    const dtMs = Math.min(Math.max(0, t - last.t), MAX_EXTRAP_MS);
    return last.distM + last.speedMps * (dtMs / 1000);
  }
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].t >= t) {
      const s0 = samples[i - 1];
      const s1 = samples[i];
      const span = s1.t - s0.t;
      const u = span > 0 ? (t - s0.t) / span : 0;
      return s0.distM + (s1.distM - s0.distM) * u;
    }
  }
  return last.distM;
}

function predictAt(samples, t) {
  if (!samples.length) return null;
  let last = samples[0];
  for (const s of samples) {
    if (s.t > t) break;
    last = s;
  }
  return last.distM + last.speedMps * ((t - last.t) / 1000);
}

function thin(samples, tMs) {
  if (!samples.length) return [];
  const out = [samples[0]];
  for (const s of samples) {
    if (s.t - out[out.length - 1].t >= tMs) out.push(s);
  }
  return out;
}

function fitness(samples) {
  if (samples.length < 3) {
    return {
      n: samples.length,
      durationSec: 0,
      speedMps: { min: null, max: null, mean: null, stdev: null },
      accelHiSec: 0,
      accelHiFrac: 0,
      stopRestart: false,
      hasJerk: false,
    };
  }
  const speeds = samples.map((s) => s.speedMps);
  const durationSec = (samples[samples.length - 1].t - samples[0].t) / 1000;
  let accelHiSec = 0;
  let sawStop = false;
  let stopRestart = false;
  for (let i = 1; i < samples.length; i += 1) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (dt < 0.04) continue;
    const a = (samples[i].speedMps - samples[i - 1].speedMps) / dt;
    if (Math.abs(a) > ACCEL_THRESH) accelHiSec += dt;
    const stopped = samples[i].speedMps <= STOP_MPS;
    if (sawStop && !stopped) stopRestart = true;
    if (stopped) sawStop = true;
  }
  return {
    n: samples.length,
    durationSec,
    speedMps: {
      min: Math.min(...speeds),
      max: Math.max(...speeds),
      mean: mean(speeds),
      stdev: stdev(speeds),
    },
    accelHiSec,
    accelHiFrac: durationSec > 0 ? accelHiSec / durationSec : 0,
    stopRestart,
    hasJerk: accelHiSec >= 0.5,
  };
}

function toPx(m, pxPerM) {
  return m == null || pxPerM == null ? null : m * pxPerM;
}

function errorStats(signed, pxPerM) {
  const abs = signed.map((x) => Math.abs(x)).sort((a, b) => a - b);
  const p50 = percentile(abs, 50);
  const p90 = percentile(abs, 90);
  const max = abs.length ? abs[abs.length - 1] : null;
  return {
    n: signed.length,
    p50m: p50,
    p90m: p90,
    maxM: max,
    p50px: toPx(p50, pxPerM),
    p90px: toPx(p90, pxPerM),
    maxPx: toPx(max, pxPerM),
    meanSignedM: mean(signed),
  };
}

function jerkTimes(samples) {
  const times = [];
  for (let i = 1; i < samples.length; i += 1) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (dt < 0.04) continue;
    const a = (samples[i].speedMps - samples[i - 1].speedMps) / dt;
    if (Math.abs(a) > ACCEL_THRESH) times.push(samples[i].t);
  }
  return times;
}

function evaluate(samples, frames, thinned, mode, delayMs, tMs, pxPerM) {
  const signed = [];
  const gapBias = [];
  let abreast = 0;
  let reverse = 0;
  const jerks = jerkTimes(samples);
  const jerkLo = jerks.length ? Math.min(...jerks) - 250 : null;
  const jerkHi = jerks.length ? Math.max(...jerks) + tMs : null;
  let jerkN = 0;
  let jerkMaxAbs = 0;
  for (const f of frames) {
    const truthPeer = interpAt(samples, f.atMs, { extrap: true });
    if (truthPeer == null) continue;
    const recon =
      mode === "interp"
        ? interpAt(thinned, f.atMs - delayMs, { extrap: true })
        : predictAt(thinned, f.atMs);
    if (recon == null) continue;
    const err = recon - truthPeer;
    signed.push(err);
    const actualGap = truthPeer - f.selfM;
    const shownGap = recon - f.selfM;
    gapBias.push(shownGap - actualGap);
    if (Math.abs(actualGap) <= CHIEF_GAP_M) {
      abreast += 1;
      if (Math.sign(actualGap) !== 0 && Math.sign(shownGap) !== Math.sign(actualGap)) reverse += 1;
    }
    if (jerkLo != null && f.atMs >= jerkLo && f.atMs <= jerkHi) {
      jerkN += 1;
      jerkMaxAbs = Math.max(jerkMaxAbs, Math.abs(err));
    }
  }
  return {
    delayMs,
    ...errorStats(signed, pxPerM),
    rankBiasM: mean(gapBias),
    abreastFrames: abreast,
    reverseFrames: reverse,
    reverseRatio: abreast > 0 ? reverse / abreast : null,
    jerkFrames: jerkN,
    jerkMaxAbsM: jerkN ? jerkMaxAbs : null,
  };
}

function adaptPublishCount(samples, threshM) {
  if (!samples.length) return { n: 0, vsOriginal: null };
  let n = 1;
  let last = samples[0];
  for (const s of samples) {
    const pred = last.distM + last.speedMps * ((s.t - last.t) / 1000);
    if (Math.abs(pred - s.distM) > threshM) {
      n += 1;
      last = s;
    }
  }
  return { n, vsOriginal: n / samples.length };
}

function currentReverseRatio(samples, frames) {
  let abreast = 0;
  let reverse = 0;
  for (const f of frames) {
    const truthPeer = interpAt(samples, f.atMs, { extrap: true });
    if (truthPeer == null) continue;
    const actualGap = truthPeer - f.selfM;
    const shownGap = f.peerDisplayM - f.selfM;
    if (Math.abs(actualGap) <= CHIEF_GAP_M) {
      abreast += 1;
      if (Math.sign(actualGap) !== 0 && Math.sign(shownGap) !== Math.sign(actualGap)) reverse += 1;
    }
  }
  return { abreast, reverse, reverseRatio: abreast > 0 ? reverse / abreast : null };
}

function runLog(id, samples, frames, pxPerM, source) {
  const fit = fitness(samples);
  const currentRev = currentReverseRatio(samples, frames);
  const origHz = fit.durationSec > 0 ? samples.length / fit.durationSec : null;
  const rows = [];
  for (const tSec of T_SEC) {
    const tMs = tSec * 1000;
    const thinned = thin(samples, tMs);
    const delayMs = Math.max(DELAY_FLOOR_MS, tMs);
    const a = evaluate(samples, frames, thinned, "interp", delayMs, tMs, pxPerM);
    const b = evaluate(samples, frames, thinned, "predict", 0, tMs, pxPerM);
    const expectedABias = -(fit.speedMps.mean ?? 0) * (delayMs / 1000);
    const gate1 = b.rankBiasM == null ? null : Math.abs(b.rankBiasM) <= CURRENT_BIAS_M;
    const gate2 =
      b.reverseRatio == null || currentRev.reverseRatio == null
        ? null
        : b.reverseRatio <= currentRev.reverseRatio + 1e-12;
    const gate3 = !fit.hasJerk
      ? "unverified"
      : b.jerkMaxAbsM == null
        ? null
        : b.jerkMaxAbsM <= GATE3_MAX_ERR_M;
    const passG12 = gate1 === true && gate2 === true;
    const passAll = passG12 && (gate3 === true);
    rows.push({
      tSec,
      thinnedN: thinned.length,
      windowShorterThanT: fit.durationSec > 0 && fit.durationSec < tSec,
      expectedABiasM: expectedABias,
      a,
      b,
      gates: {
        g1_bias: gate1,
        g2_reverse: gate2,
        g3_jerkMax: gate3,
        passG12,
        passAll,
      },
    });
  }
  const adapt = {};
  for (const th of ADAPT_THRESH_M) {
    adapt[String(th)] = {
      ...adaptPublishCount(samples, th),
      originalN: samples.length,
      originalHz: origHz,
    };
  }
  return {
    id,
    source,
    truth:
      "정답 = 솎기 전 ingest 궤적을 비교 시각에 선형 보간한 값. 재구성은 솎은 샘플만 본다.",
    fitness: fit,
    currentReverse: currentRev,
    pxPerM,
    abreastDef: `|actualGap| <= ${CHIEF_GAP_M} m`,
    rows,
    adapt,
  };
}

/** 5 km/h 등속 → 1.39 m/s² 감속 정지 2 s → 같은 가속도로 재출발. 실측 아님. */
function syntheticCruiseJerk() {
  const events = [];
  const start = 10_000;
  let dist = 20;
  let v = 5 / 3.6;
  let t = start;
  const push = (dt, nv) => {
    const mid = (v + nv) / 2;
    t += dt;
    dist += mid * (dt / 1000);
    v = nv;
    events.push({
      kind: "ingest",
      atMs: t,
      rtdb: { recvAtMs: t, serverAtMs: t, distM: dist, speedMps: v },
    });
    events.push({
      kind: "display",
      atMs: t,
      displayDistM: dist,
      localDistM: dist - 3.2,
    });
  };
  for (let i = 0; i < 50; i += 1) push(100, 5 / 3.6);
  for (let i = 0; i < 10; i += 1) push(100, Math.max(0, v - 1.39 * 0.1));
  for (let i = 0; i < 20; i += 1) push(100, 0);
  for (let i = 0; i < 10; i += 1) push(100, Math.min(5 / 3.6, v + 1.39 * 0.1));
  for (let i = 0; i < 40; i += 1) push(100, 5 / 3.6);
  return events;
}

function loadPxPerM() {
  try {
    const j = JSON.parse(readFileSync(resolve(RELAY, "S47-scale-16m.json"), "utf8"));
    if (Number.isFinite(j.pxPerM) && j.pxPerM > 0) return j.pxPerM;
  } catch {
    /* scale file may not exist yet */
  }
  return null;
}

function printFitness(results) {
  console.log("\n=== V0 로그 적합성 ===");
  for (const r of results) {
    const f = r.fitness;
    const sp = f.speedMps;
    console.log(
      [
        r.id,
        `n=${f.n}`,
        `${(f.durationSec ?? 0).toFixed(1)}s`,
        `v ${sp.min?.toFixed?.(3)}–${sp.max?.toFixed?.(3)} m/s`,
        `σ=${sp.stdev?.toFixed?.(4)}`,
        `|a|>0.3 ${f.accelHiSec?.toFixed?.(2)}s (${((f.accelHiFrac ?? 0) * 100).toFixed(1)}%)`,
        `정지·재출발=${f.stopRestart}`,
        `hasJerk=${f.hasJerk}`,
      ].join("  "),
    );
  }
}

function compactRow(row) {
  return {
    tSec: row.tSec,
    thinnedN: row.thinnedN,
    a_biasM: row.a.rankBiasM,
    a_maxM: row.a.maxM,
    a_reverseRatio: row.a.reverseRatio,
    b_biasM: row.b.rankBiasM,
    b_p50m: row.b.p50m,
    b_p90m: row.b.p90m,
    b_maxM: row.b.maxM,
    b_p50px: row.b.p50px,
    b_p90px: row.b.p90px,
    b_maxPx: row.b.maxPx,
    b_reverseRatio: row.b.reverseRatio,
    b_jerkMaxAbsM: row.b.jerkMaxAbsM,
    gates: row.gates,
  };
}

function main() {
  mkdirSync(RELAY, { recursive: true });
  const pxPerM = loadPxPerM();
  const results = [];
  for (const log of LOGS) {
    const raw = JSON.parse(readFileSync(resolve(RELAY, log.file), "utf8"));
    const samples = ingestSamples(raw.events ?? []);
    const frames = displayFrames(raw.events ?? []);
    const r = runLog(log.id, samples, frames, pxPerM, log.file);
    results.push(r);
    writeFileSync(resolve(RELAY, `S47-prediction-${log.id}.json`), JSON.stringify(r, null, 2));
  }
  printFitness(results);

  const synEvents = syntheticCruiseJerk();
  const syn = runLog(
    "synthetic-stop-restart",
    ingestSamples(synEvents),
    displayFrames(synEvents),
    pxPerM,
    "synthetic: 5km/h 등속 → 1.39m/s² 1s 감속 → 정지 2s → 1.39m/s² 재가속. 실측 아님.",
  );
  writeFileSync(resolve(RELAY, "S47-prediction-synthetic.json"), JSON.stringify(syn, null, 2));
  printFitness([syn]);

  const realHasJerk = results.some((r) => r.fitness.hasJerk);
  const candidates = [];
  for (const tSec of T_SEC) {
    const realOk = results.every((r) => r.rows.find((row) => row.tSec === tSec)?.gates.passG12 === true);
    const synOk = syn.rows.find((row) => row.tSec === tSec)?.gates.passAll === true;
    if (realOk && synOk) candidates.push(tSec);
  }
  const maxPassT = candidates.length ? Math.max(...candidates) : null;

  const summary = {
    instruction: "S4-7",
    pxPerM,
    pxPerMNote:
      pxPerM == null
        ? "S47-scale-16m.json 없음. m 만 보고 px 는 null."
        : "S47-scale-16m.json 실측값으로 m→px 환산",
    realHasJerk,
    jerkNote: realHasJerk
      ? "실측 로그에 |a|>0.3 급변 있음"
      : "실측 로그는 급변 조건 미검증. 게이트3 은 합성 시나리오로만 판정. 실측과 구분.",
    currentBiasLimitM: CURRENT_BIAS_M,
    gate3MaxErrM: GATE3_MAX_ERR_M,
    maxPassTSec: maxPassT,
    verdict: maxPassT == null ? "관성 접근 불가 — 통과 T 없음" : `통과 최대 T = ${maxPassT} s`,
    logs: results.map((r) => ({
      id: r.id,
      fitness: r.fitness,
      currentReverse: r.currentReverse,
      rows: r.rows.map(compactRow),
      adapt: r.adapt,
    })),
    synthetic: {
      id: syn.id,
      source: syn.source,
      fitness: syn.fitness,
      currentReverse: syn.currentReverse,
      rows: syn.rows.map(compactRow),
      adapt: syn.adapt,
    },
  };
  writeFileSync(resolve(RELAY, "S47-prediction-summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\npxPerM=${pxPerM}`);
  console.log(`maxPassT=${maxPassT}`);
  console.log(`verdict=${summary.verdict}`);
  for (const r of [...results, syn]) {
    console.log(`\n-- ${r.id} --`);
    for (const row of r.rows) {
      console.log(
        `T=${row.tSec}s  a.bias=${row.a.rankBiasM?.toFixed?.(3)}  b.bias=${row.b.rankBiasM?.toFixed?.(3)}  ` +
          `b.max=${row.b.maxM?.toFixed?.(3)}  b.rev=${row.b.reverseRatio?.toFixed?.(3)}  ` +
          `b.jerkMax=${row.b.jerkMaxAbsM?.toFixed?.(3)}  g1=${row.gates.g1_bias} g2=${row.gates.g2_reverse} g3=${row.gates.g3_jerkMax}`,
      );
    }
  }
}

main();
