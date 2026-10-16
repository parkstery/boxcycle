/**
 * 페이서·동행 경로 거리를 강제 rAF 간격으로 재생한다.
 *
 * 제품 함수만 사용한다. 표시 시계 입력은 MapView 틱과 같이 epoch(소수 ms) 이다.
 * 같은 epoch 값만 재사용한다.
 *
 * 불규칙 간격(20/30, 16.7/33.3)에서는 지도 틱이 세션 적분보다 먼저 읽는 위상과,
 * 동행 step 에 프레임 epoch 가 아니라 한 박자 늦은 시계를 넣는 경우를 같이 잰다.
 * speedCv 는 그 프레임 rAF 간격으로 나눈 이동 거리의 변동계수다.
 *
 *   cd apps/web
 *   node scripts/jitter/raf-beat-replay.mjs
 */
import { createServer } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SPEED_KMH = 20;
const SPEED_MPS = SPEED_KMH / 3.6;
const ROUTE_M = 20_000;
const RUN_MS = 8_000;
const WARMUP_MS = 2_000;
const PUBLISH_MS = 200;
const CAMERA_TAU_SEC = 0.1;
const EPOCH0 = 1_700_000_000_000;
const START_DIST_M = 100;

export const REPLAY_HZ = [60, 120, 144, 165];
/** 속도 일정 주행에서 화면 속도 변동계수 상한. */
export const SPEED_CV_MAX = 0.05;

export const IRREGULAR_SCENARIOS = [
  { id: "mix-20-30", a: 20, b: 30, seed: 20261016 },
  { id: "mix-16.7-33.3", a: 1000 / 60, b: 1000 / 30, seed: 20261017 },
];

export function statsOf(samples) {
  let reverse = 0;
  let maxReverse = 0;
  const speeds = [];
  for (let i = 1; i < samples.length; i += 1) {
    const dd = samples[i].v - samples[i - 1].v;
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (dd < -1e-4) {
      reverse += 1;
      if (-dd > maxReverse) maxReverse = -dd;
    }
    if (dt > 0) speeds.push(dd / dt);
  }
  let cv = null;
  if (speeds.length >= 2) {
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    if (Math.abs(mean) >= 1e-6) {
      const variance = speeds.reduce((a, s) => a + (s - mean) ** 2, 0) / speeds.length;
      cv = Math.sqrt(variance) / mean;
    }
  }
  return {
    frames: samples.length,
    reverse,
    maxReverseM: Number(maxReverse.toFixed(4)),
    speedCv: cv == null ? null : Number(cv.toFixed(4)),
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 8초 동안 a/b 를 시드로 반반 섞는다. */
export function mixedFrameDts(a, b, seed, runMs = RUN_MS) {
  const rng = mulberry32(seed);
  const dts = [];
  let acc = 0;
  while (acc < runMs) {
    const dt = rng() < 0.5 ? a : b;
    dts.push(dt);
    acc += dt;
  }
  return dts;
}

function steadySamples(rows) {
  return rows.filter((row) => row.t >= WARMUP_MS);
}

function resetRide(api) {
  api.resetServerOffset();
  api.setServerOffset(0);
  api.resetCommonDisplayClock();
  api.resetSelfDisplayBuffer();
  api.setCompanionDisplayActive(false);
}

export function replay(api, dtMs, withBuffer) {
  const frames = Math.round(RUN_MS / dtMs);
  const dts = Array.from({ length: frames }, () => dtMs);
  const run = replayFrames(api, dts, withBuffer);
  return {
    ...run,
    hz: Number((1000 / dtMs).toFixed(2)),
    dtMs,
  };
}

/**
 * 한 루프에서 적분과 표시를 같이 한다. 간격이 일정하면 위상 차이가 없어도
 * 버퍼 catch-up 이 거리를 갈아끼우는지 본다.
 */
export function replayFrames(api, dts, withBuffer) {
  const {
    advanceSelfDisplayRenderTimeMs,
    companionDisplayDelayMs,
    isDisplayRenderCatchingUp,
    pushSelfDisplaySample,
    sampleSelfDisplayDistM,
    createPacerWorld,
    stepPacerWorld,
    resolvePacerDistM,
  } = api;

  resetRide(api);

  const world = createPacerWorld(1, { staggerEntry: false });
  let virtual = START_DIST_M;
  let cache = null;
  let lastPublish = -1e9;
  let perf = 0;
  let cam = virtual;
  const self = [];
  const along = [];
  const gap = [];
  const camRel = [];
  let catchingUpFrames = 0;
  let renderHoldFrames = 0;
  let prevRender = null;

  for (const dtMs of dts) {
    const prevPerf = perf;
    perf += dtMs;
    const epoch = EPOCH0 + perf;
    const dtSec = (perf - prevPerf) / 1000;
    virtual += SPEED_MPS * dtSec;

    if (withBuffer && epoch - lastPublish >= PUBLISH_MS) {
      pushSelfDisplaySample({ tSrv: epoch, distM: virtual, speedMps: SPEED_MPS });
      lastPublish = epoch;
    }

    let selfDist;
    if (cache && cache.now === epoch) selfDist = cache.dist;
    else {
      const renderTime = advanceSelfDisplayRenderTimeMs(epoch);
      const delayed = sampleSelfDisplayDistM(renderTime);
      const delayMs = companionDisplayDelayMs();
      const catchingUp = isDisplayRenderCatchingUp(epoch);
      if (perf >= WARMUP_MS) {
        if (catchingUp) catchingUpFrames += 1;
        if (prevRender != null && renderTime === prevRender) renderHoldFrames += 1;
      }
      prevRender = renderTime;
      let src = virtual;
      if (delayed != null && (delayMs > 0 || catchingUp)) src = delayed;
      cache = { now: epoch, dist: src };
      selfDist = src;
    }

    stepPacerWorld(world, { dtSec, selfSpeedMps: SPEED_MPS, status: "running" });
    const pacer = world.pacers[0];
    const alongM = resolvePacerDistM(selfDist, pacer.gapM, ROUTE_M);
    const alpha = 1 - Math.exp(-dtSec / CAMERA_TAU_SEC);
    cam += (selfDist - cam) * alpha;

    self.push({ t: perf, v: selfDist });
    along.push({ t: perf, v: alongM });
    gap.push({ t: perf, v: alongM - selfDist });
    camRel.push({ t: perf, v: alongM - cam });
  }

  resetRide(api);

  return {
    withBuffer,
    catchingUpFrames,
    renderHoldFrames,
    self: statsOf(steadySamples(self)),
    along: statsOf(steadySamples(along)),
    gap: statsOf(steadySamples(gap)),
    camRel: statsOf(steadySamples(camRel)),
  };
}

/**
 * 지도 rAF 가 세션 적분보다 먼저 거리를 읽는 순서.
 * project 가 꺼지면 이동량은 이전 간격, 분모는 이번 rAF 간격이다.
 */
export function replayPhaseLag(api, dts, project) {
  const { createPacerWorld, stepPacerWorld, resolvePacerDistM, projectRideDistToFramePerfMs } = api;
  resetRide(api);
  const world = createPacerWorld(1, { staggerEntry: false });
  let virtual = START_DIST_M;
  let lastIntegr = 0;
  let perf = 0;
  let cam = virtual;
  const self = [];
  const along = [];
  const camRel = [];

  for (const dtMs of dts) {
    const prevPerf = perf;
    perf += dtMs;
    const dtSec = (perf - prevPerf) / 1000;
    const selfDist = project
      ? projectRideDistToFramePerfMs(virtual, SPEED_KMH, SPEED_KMH, lastIntegr, perf)
      : virtual;
    stepPacerWorld(world, { dtSec, selfSpeedMps: SPEED_MPS, status: "running" });
    const alongM = resolvePacerDistM(selfDist, world.pacers[0].gapM, ROUTE_M);
    const alpha = 1 - Math.exp(-dtSec / CAMERA_TAU_SEC);
    cam += (selfDist - cam) * alpha;
    self.push({ t: perf, v: selfDist });
    along.push({ t: perf, v: alongM });
    camRel.push({ t: perf, v: alongM - cam });
    virtual += SPEED_MPS * dtSec;
    lastIntegr = perf;
  }

  resetRide(api);
  return {
    project,
    self: statsOf(steadySamples(self)),
    along: statsOf(steadySamples(along)),
    camRel: statsOf(steadySamples(camRel)),
  };
}

function peerPacket(tSrv, seq) {
  const distM = START_DIST_M + SPEED_MPS * ((tSrv - EPOCH0) / 1000);
  return {
    uid: "peer-a",
    publicationId: "pub",
    distM,
    speedMps: SPEED_MPS,
    phase: "live",
    serverAtMs: tSrv,
    tSrv,
    seq,
  };
}

/**
 * 동행 표시 거리. aligned 이면 step nowMs 가 프레임 epoch.
 * 아니면 한 프레임 이전 간격으로 시계를 민다(예전 Date.now 축이 화면 rAF 와 어긋난 경우).
 */
export function replayPeerFrames(api, dts, aligned) {
  const {
    ensureFrameDisplayRenderTimeMs,
    setCompanionDisplayActive,
    createPeerMotionEntity,
    applyPeerMotionIngest,
    stepPeerMotionEntity,
  } = api;

  resetRide(api);
  api.setServerOffset(0);
  setCompanionDisplayActive(true);

  let entity = null;
  let seq = 0;
  let nextPublish = -2_000;
  const ingestUntil = (perfMs) => {
    while (nextPublish <= perfMs) {
      const packet = peerPacket(EPOCH0 + nextPublish, seq);
      seq += 1;
      if (!entity) entity = createPeerMotionEntity(packet, "peer");
      else applyPeerMotionIngest(entity, packet, "peer");
      nextPublish += PUBLISH_MS;
    }
  };
  // 지연 600ms 가 버퍼 안에 있게 과거만 넣고, 미래 패킷으로 창을 밀지 않는다.
  ingestUntil(0);

  let perf = 0;
  let clockPerf = 0;
  let prevDt = dts[0] ?? 16.7;
  const samples = [];

  for (const dtMs of dts) {
    perf += dtMs;
    ingestUntil(perf);
    if (aligned) clockPerf = perf;
    else clockPerf += prevDt;
    const nowMs = EPOCH0 + clockPerf;
    const renderTime = ensureFrameDisplayRenderTimeMs(nowMs);
    stepPeerMotionEntity(entity, dtMs / 1000, ROUTE_M, nowMs, {
      lockedRenderTimeMs: renderTime,
    });
    samples.push({ t: perf, v: entity.displayDistM });
    prevDt = dtMs;
  }

  resetRide(api);
  return statsOf(steadySamples(samples));
}

export function replayMatrix(api, hzList = REPLAY_HZ) {
  const runs = [];
  for (const hz of hzList) {
    const dtMs = 1000 / hz;
    for (const withBuffer of [false, true]) {
      runs.push(replay(api, dtMs, withBuffer));
    }
  }
  return runs;
}

export function replayIrregularReport(api) {
  const rows = [];
  for (const scenario of IRREGULAR_SCENARIOS) {
    const dts = mixedFrameDts(scenario.a, scenario.b, scenario.seed);
    const sameLoop = replayFrames(api, dts, true);
    const before = replayPhaseLag(api, dts, false);
    const after = replayPhaseLag(api, dts, true);
    const peerBefore = replayPeerFrames(api, dts, false);
    const peerAfter = replayPeerFrames(api, dts, true);
    rows.push({
      id: scenario.id,
      seed: scenario.seed,
      frames: dts.length,
      sameLoop,
      before,
      after,
      peerBefore,
      peerAfter,
    });
  }
  return rows;
}

export async function loadReplayApi() {
  const server = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    const clock = await server.ssrLoadModule("/src/lib/peerMotion/commonDisplayClock.ts");
    const buffer = await server.ssrLoadModule("/src/lib/peerMotion/selfDisplayBuffer.ts");
    const pacer = await server.ssrLoadModule("/src/lib/ride/pacer/pacerMotion.ts");
    const serverClock = await server.ssrLoadModule("/src/lib/peerMotion/repo/serverClockOffset.ts");
    const integrator = await server.ssrLoadModule("/src/lib/peerMotion/integrator.ts");
    const project = await server.ssrLoadModule("/src/lib/ride/frameDistProject.ts");
    const api = {
      resetCommonDisplayClock: clock.resetCommonDisplayClock,
      advanceSelfDisplayRenderTimeMs: clock.advanceSelfDisplayRenderTimeMs,
      ensureFrameDisplayRenderTimeMs: clock.ensureFrameDisplayRenderTimeMs,
      companionDisplayDelayMs: clock.companionDisplayDelayMs,
      isDisplayRenderCatchingUp: clock.isDisplayRenderCatchingUp,
      setCompanionDisplayActive: clock.setCompanionDisplayActive,
      resetSelfDisplayBuffer: buffer.resetSelfDisplayBuffer,
      pushSelfDisplaySample: buffer.pushSelfDisplaySample,
      sampleSelfDisplayDistM: buffer.sampleSelfDisplayDistM,
      createPacerWorld: pacer.createPacerWorld,
      stepPacerWorld: pacer.stepPacerWorld,
      resolvePacerDistM: pacer.resolvePacerDistM,
      createPeerMotionEntity: integrator.createPeerMotionEntity,
      applyPeerMotionIngest: integrator.applyPeerMotionIngest,
      stepPeerMotionEntity: integrator.stepPeerMotionEntity,
      projectRideDistToFramePerfMs: project.projectRideDistToFramePerfMs,
      setServerOffset: (ms) => serverClock.__setServerTimeOffsetForTests(ms),
      resetServerOffset: () => serverClock.__resetServerClockOffsetForTests(),
    };
    return {
      api,
      close: () => server.close(),
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}

function cvOf(stats) {
  return stats.speedCv == null ? null : stats.speedCv;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

function printIrregular(rows) {
  const cell = (stats) => {
    const cv = cvOf(stats);
    return `rev ${stats.reverse} cv ${cv == null ? "-" : cv.toFixed(4)}`;
  };
  for (const row of rows) {
    process.stdout.write(
      [
        row.id,
        `frames ${row.frames}`,
        `sameLoop self ${cell(row.sameLoop.self)} pacer ${cell(row.sameLoop.along)} hold ${row.sameLoop.renderHoldFrames} catch ${row.sameLoop.catchingUpFrames}`,
        `phaseBefore self ${cell(row.before.self)} pacer ${cell(row.before.along)} cam ${cell(row.before.camRel)}`,
        `phaseAfter self ${cell(row.after.self)} pacer ${cell(row.after.along)} cam ${cell(row.after.camRel)}`,
        `peerBefore ${cell(row.peerBefore)}`,
        `peerAfter ${cell(row.peerAfter)}`,
        "",
      ].join("\n"),
    );
  }
}

if (isDirectRun()) {
  const session = await loadReplayApi();
  try {
    const steady = replayMatrix(session.api);
    const irregular = replayIrregularReport(session.api);
    process.stdout.write(`${JSON.stringify({ steady, irregular }, null, 2)}\n`);
    printIrregular(irregular);
    const steadyBad = steady.filter(
      (run) =>
        run.self.reverse !== 0 ||
        run.along.reverse !== 0 ||
        run.camRel.reverse !== 0 ||
        cvOf(run.self) == null ||
        cvOf(run.self) > SPEED_CV_MAX ||
        cvOf(run.along) > SPEED_CV_MAX,
    );
    const irregularBad = irregular.filter((row) => {
      const afterCv = cvOf(row.after.self);
      const pacerCv = cvOf(row.after.along);
      const peerCv = cvOf(row.peerAfter);
      const beforeCv = cvOf(row.before.self);
      const peerBeforeCv = cvOf(row.peerBefore);
      return (
        row.after.self.reverse !== 0 ||
        row.after.along.reverse !== 0 ||
        row.peerAfter.reverse !== 0 ||
        afterCv == null ||
        afterCv > SPEED_CV_MAX ||
        pacerCv == null ||
        pacerCv > SPEED_CV_MAX ||
        peerCv == null ||
        peerCv > SPEED_CV_MAX ||
        beforeCv == null ||
        beforeCv <= SPEED_CV_MAX ||
        peerBeforeCv == null ||
        peerBeforeCv <= SPEED_CV_MAX
      );
    });
    if (steadyBad.length || irregularBad.length) process.exitCode = 1;
  } finally {
    await session.close();
  }
}
