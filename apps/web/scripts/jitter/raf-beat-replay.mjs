/**
 * 페이서 경로 거리를 강제 rAF 간격으로 재생한다.
 *
 * 제품 함수만 사용한다: 세션 거리(고해상 dt) → sampleLiveDistM 과 같은
 * Date.now 캐시·표시 시계 → stepPacerWorld → resolvePacerDistM.
 * 카메라는 tau 0.1 s 지수 평활만 흉내 낸다(지도 엔진 없음).
 *
 *   cd apps/web
 *   node scripts/jitter/raf-beat-replay.mjs
 */
import { createServer } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SPEED_MPS = 20 / 3.6;
const ROUTE_M = 20_000;
const RUN_MS = 8_000;
const WARMUP_MS = 2_000;
const PUBLISH_MS = 200;
const CAMERA_TAU_SEC = 0.1;

function statsOf(samples) {
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

function replay(api, dtMs, withBuffer) {
  const {
    resetCommonDisplayClock,
    advanceSelfDisplayRenderTimeMs,
    companionDisplayDelayMs,
    isDisplayRenderCatchingUp,
    resetSelfDisplayBuffer,
    pushSelfDisplaySample,
    sampleSelfDisplayDistM,
    createPacerWorld,
    stepPacerWorld,
    resolvePacerDistM,
    setServerOffset,
    resetServerOffset,
  } = api;

  resetServerOffset();
  setServerOffset(0);
  resetCommonDisplayClock();
  resetSelfDisplayBuffer();

  const world = createPacerWorld(1, { staggerEntry: false });
  let virtual = 100;
  let cache = null;
  let lastPublish = -1e9;
  let lastPerf = 0;
  let cam = virtual;
  const self = [];
  const along = [];
  const gap = [];
  const camRel = [];
  let catchingUpFrames = 0;
  let renderHoldFrames = 0;
  let prevRender = null;
  const frames = Math.round(RUN_MS / dtMs);

  for (let i = 1; i <= frames; i += 1) {
    const perf = i * dtMs;
    const dateNow = Math.floor(perf);
    const dtSec = (perf - lastPerf) / 1000;
    lastPerf = perf;
    virtual += SPEED_MPS * dtSec;

    if (withBuffer && dateNow - lastPublish >= PUBLISH_MS) {
      pushSelfDisplaySample({ tSrv: dateNow, distM: virtual, speedMps: SPEED_MPS });
      lastPublish = dateNow;
    }

    let selfDist;
    if (cache && cache.now === dateNow) selfDist = cache.dist;
    else {
      const renderTime = advanceSelfDisplayRenderTimeMs(dateNow);
      const delayed = sampleSelfDisplayDistM(renderTime);
      const delayMs = companionDisplayDelayMs();
      const catchingUp = isDisplayRenderCatchingUp(dateNow);
      if (perf >= WARMUP_MS) {
        if (catchingUp) catchingUpFrames += 1;
        if (prevRender != null && renderTime === prevRender) renderHoldFrames += 1;
      }
      prevRender = renderTime;
      let src = virtual;
      if (delayed != null && (delayMs > 0 || catchingUp)) src = delayed;
      cache = { now: dateNow, dist: src };
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

  resetServerOffset();
  resetCommonDisplayClock();
  resetSelfDisplayBuffer();

  const steady = (rows) => rows.filter((row) => row.t >= WARMUP_MS);
  return {
    dtMs,
    withBuffer,
    catchingUpFrames,
    renderHoldFrames,
    self: statsOf(steady(self)),
    along: statsOf(steady(along)),
    gap: statsOf(steady(gap)),
    camRel: statsOf(steady(camRel)),
  };
}

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
  const api = {
    resetCommonDisplayClock: clock.resetCommonDisplayClock,
    advanceSelfDisplayRenderTimeMs: clock.advanceSelfDisplayRenderTimeMs,
    companionDisplayDelayMs: clock.companionDisplayDelayMs,
    isDisplayRenderCatchingUp: clock.isDisplayRenderCatchingUp,
    resetSelfDisplayBuffer: buffer.resetSelfDisplayBuffer,
    pushSelfDisplaySample: buffer.pushSelfDisplaySample,
    sampleSelfDisplayDistM: buffer.sampleSelfDisplayDistM,
    createPacerWorld: pacer.createPacerWorld,
    stepPacerWorld: pacer.stepPacerWorld,
    resolvePacerDistM: pacer.resolvePacerDistM,
    setServerOffset: (ms) => serverClock.__setServerTimeOffsetForTests(ms),
    resetServerOffset: () => serverClock.__resetServerClockOffsetForTests(),
  };

  const runs = [];
  for (const dtMs of [16.7, 8.33, 6.9]) {
    for (const withBuffer of [false, true]) {
      runs.push(replay(api, dtMs, withBuffer));
    }
  }
  process.stdout.write(`${JSON.stringify(runs, null, 2)}\n`);
} finally {
  await server.close();
}
