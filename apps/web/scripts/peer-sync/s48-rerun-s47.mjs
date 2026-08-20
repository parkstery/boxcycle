/**
 * S4-8 — s47-experiment.mjs 는 수정하지 않는다.
 * 임시 복사본에서 입력·출력 경로만 바꿔 S48-realjerk-capture.json 을 돌린다.
 * S47-prediction-*.json 은 쓰지 않는다.
 *
 *   cd apps/web && node scripts/peer-sync/s48-rerun-s47.mjs
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELAY = resolve(HERE, "../../../../document/ops/sync-relay");
const S47_SRC = resolve(HERE, "s47-experiment.mjs");
const SYNTHETIC_A = 1.39;
const PX_PER_M = 83.44269102366391;
const STOP_MPS = 0.15;
const CRUISE_MPS = 1.2;

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

function accelReport(samples) {
  const accels = [];
  let accelHiSec = 0;
  let sawStop = false;
  let stopRestart = false;
  for (let i = 1; i < samples.length; i += 1) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (dt < 0.0005) continue;
    const a = (samples[i].speedMps - samples[i - 1].speedMps) / dt;
    accels.push({ t: samples[i].t, dt, a, absA: Math.abs(a), v0: samples[i - 1].speedMps, v1: samples[i].speedMps });
    if (Math.abs(a) > 0.3) accelHiSec += dt;
    const stopped = samples[i].speedMps <= STOP_MPS;
    if (sawStop && !stopped) stopRestart = true;
    if (stopped) sawStop = true;
  }
  const absAll = accels.map((x) => x.absA).sort((a, b) => a - b);
  const absMove = accels.filter((x) => x.absA > 0.05).map((x) => x.absA).sort((a, b) => a - b);
  const speeds = samples.map((s) => s.speedMps);
  let brake5to0 = null;
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i - 1].speedMps >= CRUISE_MPS && samples[i].speedMps <= STOP_MPS) {
      const dur = (samples[i].t - samples[i - 1].t) / 1000;
      const dv = samples[i].speedMps - samples[i - 1].speedMps;
      brake5to0 = {
        fromMps: samples[i - 1].speedMps,
        toMps: samples[i].speedMps,
        durationSec: dur,
        impliedAbsA: dur > 0 ? Math.abs(dv / dur) : null,
        startT: samples[i - 1].t,
        endT: samples[i].t,
      };
      break;
    }
  }
  const maxAbs = absAll.length ? absAll[absAll.length - 1] : null;
  const hasJerk =
    accelHiSec >= 0.5 || (maxAbs != null && maxAbs > 0.3 && stdev(speeds) > 0.01);
  const vsSynthetic =
    maxAbs == null
      ? null
      : maxAbs > SYNTHETIC_A
        ? "합성 1.39 m/s² 보다 급함 — 슬라이더/일시정지 점프. 이 로그로 T 상한을 정하지 않는다."
        : "합성 1.39 m/s² 보다 완만 — 이 로그로 T 상한을 정한다.";
  return {
    n: samples.length,
    durationSec: samples.length ? (samples[samples.length - 1].t - samples[0].t) / 1000 : 0,
    speedMps: {
      min: speeds.length ? Math.min(...speeds) : null,
      max: speeds.length ? Math.max(...speeds) : null,
      mean: mean(speeds),
      stdev: stdev(speeds),
    },
    accelAbsMps2: {
      p50: percentile(absAll, 50),
      p90: percentile(absAll, 90),
      max: maxAbs,
      movingP50: percentile(absMove, 50),
      movingP90: percentile(absMove, 90),
      movingN: absMove.length,
    },
    accelHiSec,
    stopRestart,
    hasJerk,
    brake5to0,
    vsSyntheticA: SYNTHETIC_A,
    vsSynthetic: vsSynthetic,
    tooAggressive: maxAbs != null && maxAbs > SYNTHETIC_A,
  };
}

function patchS47(src) {
  let out = src.replace(/\r\n/g, "\n");
  if (!/const LOGS = \[[\s\S]*?\];/.test(out)) {
    throw new Error("s47-experiment.mjs LOGS 블록이 예상과 다름 — 원본을 수정하지 말고 이 드라이버를 고쳐라.");
  }
  out = out.replace(
    /const LOGS = \[[\s\S]*?\];/,
    `const LOGS = [
  { id: "realjerk", file: "S48-realjerk-capture.json" },
];`,
  );
  out = out.replace(
    "writeFileSync(resolve(RELAY, `S47-prediction-${log.id}.json`), JSON.stringify(r, null, 2));",
    "writeFileSync(resolve(RELAY, \"S48-prediction-realjerk.json\"), JSON.stringify(r, null, 2));",
  );
  out = out.replace(
    "writeFileSync(resolve(RELAY, \"S47-prediction-synthetic.json\"), JSON.stringify(syn, null, 2));",
    "writeFileSync(resolve(tmpdir(), \"S48-discard-synthetic.json\"), JSON.stringify(syn, null, 2));",
  );
  out = out.replace(
    "writeFileSync(resolve(RELAY, \"S47-prediction-summary.json\"), JSON.stringify(summary, null, 2));",
    "writeFileSync(resolve(tmpdir(), \"S48-discard-s47-summary.json\"), JSON.stringify(summary, null, 2));",
  );
  if (!out.includes('from "node:os"')) {
    out = out.replace(
      'import { dirname, resolve } from "node:path";',
      'import { dirname, resolve } from "node:path";\nimport { tmpdir } from "node:os";',
    );
  }
  if (out.includes("S47-prediction-synthetic.json") || out.includes("S47-prediction-summary.json")) {
    throw new Error("S47 산출물 경로가 남아 있다 — 패치 실패.");
  }
  return out;
}

function compactFromPrediction(pred) {
  return {
    fitness: pred.fitness,
    currentReverse: pred.currentReverse,
    rows: pred.rows.map((row) => ({
      tSec: row.tSec,
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
    })),
    adapt: pred.adapt,
  };
}

function main() {
  const capturePath = resolve(RELAY, "S48-realjerk-capture.json");
  const raw = JSON.parse(readFileSync(capturePath, "utf8"));
  const samples = ingestSamples(raw.events ?? []);
  const accel = accelReport(samples);
  console.log("=== W1/W2 급변·가속도 ===");
  console.log(
    `n=${accel.n} ${accel.durationSec.toFixed(1)}s  v ${accel.speedMps.min?.toFixed?.(3)}–${accel.speedMps.max?.toFixed?.(3)} σ=${accel.speedMps.stdev?.toFixed?.(4)}`,
  );
  console.log(
    `|a| p50=${accel.accelAbsMps2.p50?.toFixed?.(3)} p90=${accel.accelAbsMps2.p90?.toFixed?.(3)} max=${accel.accelAbsMps2.max?.toFixed?.(3)}`,
  );
  console.log(`hasJerk=${accel.hasJerk} stopRestart=${accel.stopRestart} hiSec=${accel.accelHiSec.toFixed(2)}`);
  console.log("brake5to0", accel.brake5to0);
  console.log(accel.vsSynthetic);

  const src = readFileSync(S47_SRC, "utf8");
  const patched = patchS47(src);
  const tmpFile = resolve(HERE, ".s48-tmp-s47.mjs");
  writeFileSync(tmpFile, patched);
  const run = spawnSync(process.execPath, [tmpFile], { cwd: resolve(HERE, "../.."), encoding: "utf8" });
  process.stdout.write(run.stdout ?? "");
  process.stderr.write(run.stderr ?? "");
  rmSync(tmpFile, { force: true });
  if (run.status !== 0) {
    throw new Error(`s47 재실행 실패 exit=${run.status}`);
  }

  const pred = JSON.parse(readFileSync(resolve(RELAY, "S48-prediction-realjerk.json"), "utf8"));
  const syn = JSON.parse(readFileSync(resolve(RELAY, "S47-prediction-synthetic.json"), "utf8"));
  const maxPassT = accel.tooAggressive
    ? null
    : pred.rows.filter((row) => row.gates.passAll === true).map((row) => row.tSec);
  const maxPassTSec = maxPassT && maxPassT.length ? Math.max(...maxPassT) : null;

  const summary = {
    instruction: "S4-8",
    pxPerM: PX_PER_M,
    capture: {
      camera: raw.camera,
      cameraDistanceM: raw.cameraDistanceM,
      tabState: raw.tabState,
      aligned: raw.aligned,
      gapAtOpen: raw.gapAtOpen,
      stopVia: raw.stopVia,
      marks: raw.marks,
      displayFrames: raw.displayFrames,
    },
    accel,
    s47experimentUnchanged: true,
    prediction: compactFromPrediction(pred),
    s47synthetic: compactFromPrediction(syn),
    tooAggressive: accel.tooAggressive,
    maxPassTSec: accel.tooAggressive ? null : maxPassTSec,
    verdict: accel.tooAggressive
      ? "슬라이더/일시정지가 합성보다 급함. T 상한은 이 로그로 갱신하지 않는다. S4-7 합성 T=1 s 유지. Chief 실주행 절차는 지시서 §4."
      : maxPassTSec == null
        ? "실측 게이트 통과 T 없음 — 관성 접근 불가"
        : `실측 통과 최대 T = ${maxPassTSec} s`,
    s47syntheticVerdict: "S4-7 합성 T=1 통과 · T=2 부터 실패 (급변 max 1.81 m)",
  };
  writeFileSync(resolve(RELAY, "S48-realjerk-summary.json"), JSON.stringify(summary, null, 2));
  console.log(`verdict=${summary.verdict}`);
}

main();
