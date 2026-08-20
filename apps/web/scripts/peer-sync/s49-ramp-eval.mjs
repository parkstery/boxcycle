/**
 * S4-9 — 제품 stepRideSpeedKmh 로 프로파일을 만들고 고정 T / 적응 E 를 평가한다.
 * 제품 코드는 고치지 않는다. s47-experiment.mjs 는 수정하지 않는다.
 * paused 프레임은 예측 오차 집계에서 제외한다.
 *
 *   cd apps/web && node scripts/peer-sync/s49-ramp-eval.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const RELAY = resolve(HERE, "../../../../document/ops/sync-relay");

const DT_MS = 10;
const PX_PER_M_FALLBACK = 83.44269102366391;
const DELAY_FLOOR_MS = 160;
const CURRENT_BIAS_M = 0.22;
const CHIEF_GAP_M = 5;
const GATE3_MAX_ERR_M = 1.5;
const MAX_EXTRAP_MS = 1200;
const INIT_GAP_M = 3.2;
const T_SEC = [0.5, 1, 2, 4];
const E_M = [0.15, 0.3, 0.5, 1.0];
const SELF_KMH = 5;

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

function mean(xs) {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function loadPxPerM() {
  try {
    const j = JSON.parse(readFileSync(resolve(RELAY, "S47-scale-16m.json"), "utf8"));
    if (Number.isFinite(j.pxPerM) && j.pxPerM > 0) return j.pxPerM;
  } catch {
    /* S4-7 축척 파일이 없으면 폴백 */
  }
  return PX_PER_M_FALLBACK;
}

function toPx(m, pxPerM) {
  return m == null ? null : m * pxPerM;
}

function interpAt(samples, t, { extrap = true } = {}) {
  const live = samples.filter((s) => !s.paused);
  if (!live.length) return null;
  if (t <= live[0].t) return live[0].distM;
  const last = live[live.length - 1];
  if (t >= last.t) {
    if (!extrap) return last.distM;
    const dtMs = Math.min(Math.max(0, t - last.t), MAX_EXTRAP_MS);
    return last.distM + last.speedMps * (dtMs / 1000);
  }
  for (let i = 1; i < live.length; i += 1) {
    if (live[i].t >= t) {
      const s0 = live[i - 1];
      const s1 = live[i];
      const span = s1.t - s0.t;
      const u = span > 0 ? (t - s0.t) / span : 0;
      return s0.distM + (s1.distM - s0.distM) * u;
    }
  }
  return last.distM;
}

function predictAt(samples, t) {
  const live = samples.filter((s) => !s.paused && s.t <= t);
  if (!live.length) return null;
  const last = live[live.length - 1];
  return last.distM + last.speedMps * ((t - last.t) / 1000);
}

function thin(samples, tMs) {
  const live = samples.filter((s) => !s.paused);
  if (!live.length) return [];
  const out = [live[0]];
  for (const s of live) {
    if (s.t - out[out.length - 1].t >= tMs) out.push(s);
  }
  return out;
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

function evaluate(truth, frames, published, mode, delayMs, pxPerM) {
  const signed = [];
  const gapBias = [];
  let abreast = 0;
  let reverse = 0;
  let jerkMaxAbs = 0;
  let jerkN = 0;
  let worst = null;
  for (const f of frames) {
    if (f.paused) continue;
    const truthPeer = interpAt(truth, f.t, { extrap: true });
    if (truthPeer == null) continue;
    const recon =
      mode === "interp"
        ? interpAt(published, f.t - delayMs, { extrap: true })
        : predictAt(published, f.t);
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
    if (f.maneuvering) {
      jerkN += 1;
      const abs = Math.abs(err);
      if (abs >= jerkMaxAbs) {
        jerkMaxAbs = abs;
        worst = { tMs: f.t, errM: err, absM: abs, kmh: f.kmh, distM: truthPeer };
      }
    }
    if (worst == null || Math.abs(err) > worst.absM) {
      worst = { tMs: f.t, errM: err, absM: Math.abs(err), kmh: f.kmh, distM: truthPeer };
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
    worst,
  };
}

function currentReverse(truth, frames, pxPerM) {
  return evaluate(truth, frames, truth, "interp", DELAY_FLOOR_MS, pxPerM);
}

function gates(b, currentRev) {
  const g1 = b.rankBiasM == null ? null : Math.abs(b.rankBiasM) <= CURRENT_BIAS_M;
  const g2 =
    b.reverseRatio == null || currentRev.reverseRatio == null
      ? null
      : b.reverseRatio <= currentRev.reverseRatio + 1e-12;
  const g3 = b.maxM == null ? null : b.maxM <= GATE3_MAX_ERR_M;
  return { g1_bias: g1, g2_reverse: g2, g3_maxErr: g3, pass: g1 === true && g2 === true && g3 === true };
}

function publishStats(published) {
  if (published.length < 2) {
    return {
      n: published.length,
      meanIntervalMs: null,
      cruiseMeanMs: null,
      cruiseN: 0,
      maneuverMeanMs: null,
      maneuverN: 0,
      cruisePublishN: published.filter((s) => !s.maneuvering).length,
      maneuverPublishN: published.filter((s) => s.maneuvering).length,
    };
  }
  const gaps = [];
  const cruise = [];
  const maneuver = [];
  for (let i = 1; i < published.length; i += 1) {
    const dt = published[i].t - published[i - 1].t;
    gaps.push(dt);
    if (!published[i - 1].maneuvering && !published[i].maneuvering) cruise.push(dt);
    else maneuver.push(dt);
  }
  return {
    n: published.length,
    meanIntervalMs: mean(gaps),
    cruiseMeanMs: mean(cruise),
    cruiseN: cruise.length,
    maneuverMeanMs: mean(maneuver),
    maneuverN: maneuver.length,
    cruisePublishN: published.filter((s) => !s.maneuvering).length,
    maneuverPublishN: published.filter((s) => s.maneuvering).length,
  };
}

function adaptivePublish(truth, eM) {
  const live = truth.filter((s) => !s.paused);
  if (!live.length) return [];
  const out = [live[0]];
  let last = live[0];
  for (const s of live) {
    const pred = last.distM + last.speedMps * ((s.t - last.t) / 1000);
    if (Math.abs(pred - s.distM) > eM) {
      out.push(s);
      last = s;
    }
  }
  return out;
}

function accelCheck(samples, accelMps2, decelMps2) {
  let maxAccel = 0;
  let maxDecel = 0;
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].paused || samples[i - 1].paused) continue;
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (dt < 0.0005) continue;
    const a = (samples[i].speedMps - samples[i - 1].speedMps) / dt;
    if (a > maxAccel) maxAccel = a;
    if (-a > maxDecel) maxDecel = -a;
  }
  const accOk = maxAccel <= accelMps2 + 0.02;
  const decOk = maxDecel <= decelMps2 + 0.02;
  const accMatch = maxAccel < 0.05 || Math.abs(maxAccel - accelMps2) / accelMps2 < 0.03;
  const decMatch = maxDecel < 0.05 || Math.abs(maxDecel - decelMps2) / decelMps2 < 0.03;
  return {
    maxAccelMps2: maxAccel,
    maxDecelMps2: maxDecel,
    rampAccelMps2: accelMps2,
    rampDecelMps2: decelMps2,
    match: accOk && decOk && (maxAccel < 0.05 || accMatch) && (maxDecel < 0.05 || decMatch),
  };
}

function runUntil(stepRideSpeedKmh, startKmh, targetKmh, extraHoldMs = 0) {
  const segs = [];
  let kmh = startKmh;
  let ms = 0;
  const cap = 30_000;
  while (kmh !== targetKmh && ms < cap) {
    kmh = stepRideSpeedKmh(kmh, targetKmh, DT_MS);
    ms += DT_MS;
  }
  segs.push({ durationMs: ms + extraHoldMs, targetKmh });
  return { durationMs: ms, segs };
}

function generate(stepRideSpeedKmh, id, startKmh, segments) {
  let t = 0;
  let kmh = startKmh;
  let dist = 20;
  const samples = [];
  for (const seg of segments) {
    let elapsed = 0;
    while (elapsed < seg.durationMs) {
      const prev = kmh;
      kmh = stepRideSpeedKmh(kmh, seg.targetKmh, DT_MS);
      const speedMps = kmh / 3.6;
      dist += speedMps * (DT_MS / 1000);
      const paused = seg.paused === true;
      const maneuvering = paused ? false : Math.abs(kmh - prev) > 1e-9 || kmh !== seg.targetKmh;
      samples.push({
        t,
        distM: dist,
        speedMps: paused ? 0 : speedMps,
        kmh: paused ? 0 : kmh,
        paused,
        maneuvering,
      });
      t += DT_MS;
      elapsed += DT_MS;
    }
  }
  return { id, startKmh, samples };
}

function framesFrom(samples) {
  const t0 = samples[0].t;
  const self0 = samples[0].distM - INIT_GAP_M;
  const selfMps = SELF_KMH / 3.6;
  return samples.map((s) => ({
    t: s.t,
    selfM: self0 + selfMps * ((s.t - t0) / 1000),
    kmh: s.kmh,
    paused: s.paused,
    maneuvering: s.maneuvering,
  }));
}

function compactEval(ev, extra = {}) {
  return {
    ...extra,
    n: ev.n,
    p50m: ev.p50m,
    p90m: ev.p90m,
    maxM: ev.maxM,
    p50px: ev.p50px,
    p90px: ev.p90px,
    maxPx: ev.maxPx,
    rankBiasM: ev.rankBiasM,
    reverseRatio: ev.reverseRatio,
    jerkMaxAbsM: ev.jerkMaxAbsM,
    worst: ev.worst,
  };
}

async function loadRamp() {
  const vite = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    return await vite.ssrLoadModule("./src/lib/rideSpeedRamp.ts");
  } finally {
    await vite.close();
  }
}

async function main() {
  mkdirSync(RELAY, { recursive: true });
  const pxPerM = loadPxPerM();
  const ramp = await loadRamp();
  const { stepRideSpeedKmh, RIDE_SPEED_ACCEL_KMH_PER_SEC, RIDE_SPEED_DECEL_KMH_PER_SEC } = ramp;
  const accelMps2 = RIDE_SPEED_ACCEL_KMH_PER_SEC / 3.6;
  const decelMps2 = RIDE_SPEED_DECEL_KMH_PER_SEC / 3.6;

  const p1Stop = runUntil(stepRideSpeedKmh, 20, 0, 2000);
  const p2Go = runUntil(stepRideSpeedKmh, 0, 20, 2000);
  const p3Stop = runUntil(stepRideSpeedKmh, 5, 0, 1000);
  const p3Go = runUntil(stepRideSpeedKmh, 0, 5, 2000);
  const p4Up = runUntil(stepRideSpeedKmh, 5, 12, 400);
  const p4Down = runUntil(stepRideSpeedKmh, 12, 5, 400);

  const specs = [
    {
      id: "P1-brake-20-0",
      label: "최대 제동 20→0",
      startKmh: 20,
      segments: [{ durationMs: 2000, targetKmh: 20 }, ...p1Stop.segs],
    },
    {
      id: "P2-accel-0-20",
      label: "최대 가속 0→20",
      startKmh: 0,
      segments: [{ durationMs: 1000, targetKmh: 0 }, ...p2Go.segs],
    },
    {
      id: "P3-chief-5-0-5",
      label: "Chief 저속 5→0→5 (램프 정지, paused 아님)",
      startKmh: 5,
      segments: [
        { durationMs: 3000, targetKmh: 5 },
        ...p3Stop.segs,
        ...p3Go.segs,
        { durationMs: 2000, targetKmh: 5 },
      ],
    },
    {
      id: "P4-5-12-x3",
      label: "5↔12 왕복 3회",
      startKmh: 5,
      segments: [
        { durationMs: 1500, targetKmh: 5 },
        ...p4Up.segs,
        ...p4Down.segs,
        ...p4Up.segs,
        ...p4Down.segs,
        ...p4Up.segs,
        ...p4Down.segs,
        { durationMs: 1500, targetKmh: 5 },
      ],
    },
  ];

  const profiles = specs.map((sp) => {
    const g = generate(stepRideSpeedKmh, sp.id, sp.startKmh, sp.segments);
    const check = accelCheck(g.samples, accelMps2, decelMps2);
    const pausedN = g.samples.filter((s) => s.paused).length;
    return {
      ...g,
      label: sp.label,
      accelCheck: check,
      pausedFrames: pausedN,
      durationSec: (g.samples.at(-1).t - g.samples[0].t) / 1000,
      rampTimes: {
        p1StopMs: sp.id.startsWith("P1") ? p1Stop.durationMs : undefined,
        p2GoMs: sp.id.startsWith("P2") ? p2Go.durationMs : undefined,
      },
    };
  });

  const x0ok = profiles.every((p) => p.accelCheck.match);
  const profileOut = {
    instruction: "S4-9",
    source: "vite ssrLoadModule src/lib/rideSpeedRamp.ts — stepRideSpeedKmh 직접 호출",
    dtMs: DT_MS,
    pxPerM,
    ramp: {
      accelKmhPerSec: RIDE_SPEED_ACCEL_KMH_PER_SEC,
      decelKmhPerSec: RIDE_SPEED_DECEL_KMH_PER_SEC,
      accelMps2,
      decelMps2,
    },
    pausedPolicy:
      "paused 프레임은 예측 오차 집계에서 제외. 이번 프로파일은 램프로 0까지 감속하며 상태 전이 paused 를 넣지 않았다.",
    x0ok,
    profiles: profiles.map((p) => ({
      id: p.id,
      label: p.label,
      n: p.samples.length,
      durationSec: p.durationSec,
      pausedFrames: p.pausedFrames,
      accelCheck: p.accelCheck,
    })),
  };
  writeFileSync(resolve(RELAY, "S49-profiles.json"), JSON.stringify(profileOut, null, 2));
  console.log("=== X0 프로파일 자가 검산 ===");
  for (const p of profiles) {
    const c = p.accelCheck;
    console.log(
      `${p.id}  a↑ ${c.maxAccelMps2.toFixed(4)} vs ${c.rampAccelMps2.toFixed(4)}  a↓ ${c.maxDecelMps2.toFixed(4)} vs ${c.rampDecelMps2.toFixed(4)}  match=${c.match}`,
    );
  }
  if (!x0ok) {
    console.error("X0 실패 — 램프 상한과 불일치. 이후 지표를 쓰지 않는다.");
    writeFileSync(
      resolve(RELAY, "S49-summary.json"),
      JSON.stringify({ instruction: "S4-9", x0ok: false, verdict: "프로파일 생성 실패" }, null, 2),
    );
    process.exit(1);
  }

  const perProfile = profiles.map((p) => {
    const frames = framesFrom(p.samples);
    const cur = currentReverse(p.samples, frames, pxPerM);
    const fixed = T_SEC.map((tSec) => {
      const tMs = tSec * 1000;
      const thinned = thin(p.samples, tMs);
      const delayMs = Math.max(DELAY_FLOOR_MS, tMs);
      const a = evaluate(p.samples, frames, thinned, "interp", delayMs, pxPerM);
      const b = evaluate(p.samples, frames, thinned, "predict", 0, pxPerM);
      return {
        tSec,
        publish: publishStats(thinned),
        a: compactEval(a),
        b: compactEval(b),
        gatesA: gates(a, cur),
        gatesB: gates(b, cur),
      };
    });
    const adaptive = E_M.map((eM) => {
      const pub = adaptivePublish(p.samples, eM);
      const b = evaluate(p.samples, frames, pub, "predict", 0, pxPerM);
      const maxM = b.maxM;
      const bounded = maxM == null ? null : maxM <= eM + 1e-9;
      return {
        eM,
        publish: publishStats(pub),
        b: compactEval(b),
        gates: gates(b, cur),
        x4_maxLeE: bounded,
      };
    });
    return {
      id: p.id,
      label: p.label,
      currentReverse: { reverseRatio: cur.reverseRatio, rankBiasM: cur.rankBiasM, maxM: cur.maxM },
      pausedExcluded: true,
      pausedFrames: p.pausedFrames,
      fixed,
      adaptive,
    };
  });

  const vT = [5, 12, 20].map((kmh) => {
    const v = kmh / 3.6;
    return {
      kmh,
      vMps: v,
      rows: T_SEC.map((tSec) => ({
        tSec,
        vT: v * tSec,
        halfAT2: 0.5 * decelMps2 * tSec * tSec,
        gate3_vT: v * tSec <= GATE3_MAX_ERR_M,
        gate3_halfAT2: 0.5 * decelMps2 * tSec * tSec <= GATE3_MAX_ERR_M,
      })),
    };
  });

  const adaptiveOverall = E_M.map((eM) => {
    const rows = perProfile.map((p) => p.adaptive.find((r) => r.eM === eM));
    const passAll = rows.every((r) => r.gates.pass === true);
    const x4all = rows.every((r) => r.x4_maxLeE === true);
    const worst = rows.reduce((w, r) => (!w || (r.b.maxM ?? 0) > (w.b.maxM ?? 0) ? r : w), null);
    const worstProf = perProfile[rows.indexOf(worst)];
    return {
      eM,
      passAll,
      x4all,
      usable: passAll && x4all,
      perProfile: perProfile.map((p, i) => ({
        id: p.id,
        maxM: rows[i].b.maxM,
        rankBiasM: rows[i].b.rankBiasM,
        reverseRatio: rows[i].b.reverseRatio,
        x4: rows[i].x4_maxLeE,
        gates: rows[i].gates,
        publish: rows[i].publish,
      })),
      worst: worst
        ? { profileId: worstProf.id, ...worst.b.worst, maxM: worst.b.maxM }
        : null,
    };
  });

  const passingE = adaptiveOverall.filter((r) => r.usable).map((r) => r.eM);
  const maxE = passingE.length ? Math.max(...passingE) : null;
  const maxERow = maxE == null ? null : adaptiveOverall.find((r) => r.eM === maxE);

  const summary = {
    instruction: "S4-9",
    pxPerM,
    delayAssumption:
      "적응 평가는 전달지연 0 · 같은 틱에서 초과 감지 후 즉시 발행·적용. 표시 오차는 적용 후 궤적으로 잰다.",
    x0ok: true,
    pausedExcluded: true,
    pausedNote:
      "integrator 는 paused/completed 에서 예측하지 않고 newest.distM 을 쓴다. 오차 집계는 paused 프레임을 건너뛴다. 이번 P1–P4 는 램프 제동으로 0 에 도달하며 paused 전이를 넣지 않았다.",
    discarded: "S4-7 합성 1.39 m/s² 와 그 위의 T=1 s 상한",
    rampMps2: { accel: accelMps2, decel: decelMps2 },
    speedDependence: vT,
    profiles: perProfile,
    adaptiveOverall,
    maxPassE: maxE,
    maxPassEPublish: maxERow
      ? maxERow.perProfile.map((p) => ({
          id: p.id,
          n: p.publish.n,
          meanIntervalMs: p.publish.meanIntervalMs,
          cruiseMeanMs: p.publish.cruiseMeanMs,
          maneuverMeanMs: p.publish.maneuverMeanMs,
        }))
      : null,
    verdict:
      maxE == null
        ? "관성 접근 불가 — 통과 E 없음"
        : `통과 최대 E = ${maxE} m`,
  };

  writeFileSync(resolve(RELAY, "S49-fixed-T.json"), JSON.stringify({ instruction: "S4-9", profiles: perProfile.map((p) => ({ id: p.id, currentReverse: p.currentReverse, fixed: p.fixed })) }, null, 2));
  writeFileSync(resolve(RELAY, "S49-adaptive-E.json"), JSON.stringify({ instruction: "S4-9", adaptiveOverall, profiles: perProfile.map((p) => ({ id: p.id, adaptive: p.adaptive })) }, null, 2));
  writeFileSync(resolve(RELAY, "S49-summary.json"), JSON.stringify(summary, null, 2));

  console.log("\n=== X5 고정 T · v×T ===");
  for (const row of vT) {
    console.log(
      `${row.kmh} km/h  ` +
        row.rows.map((r) => `T=${r.tSec} → vT=${r.vT.toFixed(2)} m gate3=${r.gate3_vT}`).join("  "),
    );
  }
  console.log("\n=== X3/X4/X6 적응 E ===");
  for (const row of adaptiveOverall) {
    console.log(
      `E=${row.eM}  passAll=${row.passAll}  x4all=${row.x4all}  usable=${row.usable}  worst=${row.worst?.profileId} ${row.worst?.maxM?.toFixed?.(3)} m`,
    );
  }
  console.log(`verdict=${summary.verdict}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
