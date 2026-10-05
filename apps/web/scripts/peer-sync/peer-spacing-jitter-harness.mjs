/**
 * TASK-02 peer-spacing-jitter — 실제 수신 경로 등속 간격 진동 재현·회귀.
 *
 * 주식 `replay.mjs` / `interp-smoothness-contract` 는 단일 스트림으로
 * applyPeerMotionIngest 에 송신 t 를 그대로 넣는다. 프로덕션은 두 소스(RTDB+FS)가
 * 있으면 stampDualSourceIngestPacket 경로를 탄다.
 *
 *   cd apps/web && node scripts/peer-sync/peer-spacing-jitter-harness.mjs                  # 전체 행렬(진단)
 *   cd apps/web && node scripts/peer-sync/peer-spacing-jitter-harness.mjs --mode dual --interval 200
 *   cd apps/web && node scripts/peer-sync/peer-spacing-jitter-harness.mjs --graph
 *   cd apps/web && node scripts/peer-sync/peer-spacing-jitter-harness.mjs --gate            # pre-push 게이트(필수 셀만, exit 1)
 *   cd apps/web && node scripts/peer-sync/peer-spacing-jitter-harness.mjs --suite transitions  # 소스 전환 결정적 시험
 *   cd apps/web && node scripts/peer-sync/peer-spacing-jitter-harness.mjs --suite delay     # dual 200/1000 sin off0 지연 수렴 보고
 *
 * ── 왜 interval ≥1000ms 에는 간격 pp(spacing peak-peak) 게이트를 걸지 않는가 ──────────
 * 적응 지연 = max(160, min(3000, arrivalGapEma × 2.2)). 1s 송신이면 지연 ≈ 2200ms 이고,
 * self 는 지연 0 으로 즉시 그려지므로 self(now) − peer(과거) 평균 뒤처짐이 지연×속도
 * (20km/h 에서 ≈ 12m)로 커진다. 이 평균 뒤처짐이 EMA 수렴 중에 천천히 움직이므로 pp 가
 * 커지는 것은 **지연 정책의 결과**이지 stamp 회귀 신호가 아니다(stamp 를 도착축으로 되돌려도
 * 같은 크기의 pp 가 난다). 그래서 ≥1000ms 는 속도 대역·역행·순간이동만 게이트하고 pp 는 기록만 한다.
 * 6.71m 같은 값을 「안정 간격」이라 부르지 않는다 — 수렴 전/후 창별 지연은 `delayConvergence` 로 따로 낸다.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const OUT_DIR = resolve(HERE, ".out");

const PUB = "pub-spacing-jitter";
const LOCAL_UID = "local-rider";
const PEER_UID = "peer-rider";
const ROUTE_LEN_M = 5000;
/** ~20 km/h — 사용자 보고와 맞춤 */
const SPEED_MPS = 20 / 3.6;
const STEP_MS = 1000 / 60;
/** 적응형 지연 수렴 관찰용 — 시작 구간과 안정 구간을 분리 기록(시작 결함을 숨기지 않음) */
const STARTUP_MS = 5_000;
const STABLE_START_MS = 12_000;
const RUN_MS = 40_000;
const FS_INTERVAL_MS = 4_000;
const RTT_MS = 140;
const WALL_BASE_MS = 1_700_000_000_000;
const BACK_EPS_M = 0.5;
/** 200ms dual 목표: single 수준 간격 pp ≤0.5m */
const SPACING_PP_FAIL_M = 0.5;
/** 안정 구간 화면 속도 — 송신 ±20% */
const SPEED_BAND_FRAC = 0.2;
const TELEPORT_FAIL_M = SPEED_MPS * 2.0 * (STEP_MS / 1000) + 0.35;
/** RTDB source-stale — 이보다 긴 송신 주기는 정책 상한 밖 */
const RTDB_SOURCE_STALE_MS = 2_500;

/**
 * 전환 시험의 FS 수신 간격. 프로덕션 steady 는 4s 지만 4s 간격은 적응 지연 상한(3s) 보다 길어
 * FS-only 구간에서 외삽→hold 가 정책상 불가피하다(= stamp 와 무관). 속도 대역 판정이 의미 있도록 1s.
 * `--fs-interval 4000` 으로 바꿔 진단할 수 있다(게이트 아님).
 */
const TRANSITION_FS_INTERVAL_MS = 1_000;

const INTERVALS_MS = [100, 200, 1000, 3000];
const OFFSETS_MS = [-30_000, 0, 30_000];

function parseArgs(argv) {
  const a = {
    modes: ["dual", "single"],
    intervals: INTERVALS_MS,
    offsets: OFFSETS_MS,
    jitterPatterns: ["none", "sin", "bundle"],
    withSeq: true,
    graph: false,
    /** pre-push 게이트 — 프로덕션 회귀 셀만, requiredFail 이면 exit 1 */
    gate: false,
    /** transitions: known-fail 도 필수 실패로 센다 */
    strict: false,
    /** "" = 행렬 · "transitions" = 소스 전환 · "delay" = 지연 수렴 보고 */
    suite: "",
    fsIntervalMs: TRANSITION_FS_INTERVAL_MS,
    jsonOut: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--gate") a.gate = true;
    else if (argv[i] === "--strict") a.strict = true;
    else if (argv[i] === "--suite") a.suite = String(argv[++i]);
    else if (argv[i] === "--fs-interval") a.fsIntervalMs = Number(argv[++i]);
    else if (argv[i] === "--mode") a.modes = [String(argv[++i])];
    else if (argv[i] === "--interval") a.intervals = [Number(argv[++i])];
    else if (argv[i] === "--offset") a.offsets = [Number(argv[++i])];
    else if (argv[i] === "--jitter") a.jitterPatterns = [String(argv[++i])];
    else if (argv[i] === "--no-seq") a.withSeq = false;
    else if (argv[i] === "--graph") a.graph = true;
    else if (argv[i] === "--out") a.jsonOut = resolve(process.cwd(), argv[++i]);
  }
  if (!a.jsonOut) {
    const name = a.gate
      ? "peer-spacing-gate-metrics.json"
      : a.suite === "transitions"
        ? "peer-spacing-transitions-metrics.json"
        : a.suite === "delay"
          ? "peer-spacing-delay-metrics.json"
          : "peer-spacing-jitter-metrics.json";
    a.jsonOut = resolve(OUT_DIR, name);
  }
  return a;
}

function delayAt(pattern, k, intervalMs) {
  if (pattern === "none") return 0;
  if (pattern === "sin") {
    const j = Math.min(intervalMs * 0.9, Math.max(60, intervalMs * 0.45));
    return ((Math.sin(k * 7.13) + 1) / 2) * j;
  }
  const j = Math.min(900, Math.max(80, intervalMs * 0.85));
  return k % 2 === 0 ? j : 0;
}

function peerDistAt(captureMs) {
  return SPEED_MPS * (captureMs / 1000);
}

function makeRtdbRow(captureMs, senderOffsetMs, seq, withSeq) {
  const row = {
    uid: PEER_UID,
    publicationId: PUB,
    distM: peerDistAt(captureMs),
    speedMps: SPEED_MPS,
    ridePhase: "live",
    serverAtMs: WALL_BASE_MS + captureMs + senderOffsetMs,
  };
  if (withSeq) row.seq = seq;
  return row;
}

function makeFsRow(captureMs, recvLocalMs) {
  const distM = peerDistAt(captureMs);
  return {
    uid: PEER_UID,
    publicationId: PUB,
    progressRatio: distM / ROUTE_LEN_M,
    distMeters: distM,
    lastSeenAtMs: WALL_BASE_MS + captureMs,
    receivedAtLocalMs: WALL_BASE_MS + recvLocalMs,
    displayName: "Peer",
    speedMps: SPEED_MPS,
    ridePhase: "live",
  };
}

async function loadMods(server) {
  return {
    sync: await server.ssrLoadModule("./src/lib/peerMotion/syncFromPresence.ts"),
    registry: await server.ssrLoadModule("./src/lib/peerMotion/PeerMotionRegistry.ts"),
    integrator: await server.ssrLoadModule("./src/lib/peerMotion/integrator.ts"),
  };
}

/** 프로덕션 peerRenderDelayMs — 로드 실패 시에만 재계산(max(160, min(3000, gap×2.2))). */
function effectiveDelayMs(mods, entity) {
  if (typeof mods.integrator?.peerRenderDelayMs === "function") {
    return mods.integrator.peerRenderDelayMs(entity);
  }
  const gap = entity.arrivalGapMsEma;
  if (!(gap > 0)) return 160;
  return Math.max(160, Math.min(3000, gap * 2.2));
}

const DELAY_WINDOWS = [
  ["0-5s", 0, 5_000],
  ["5-12s", 5_000, 12_000],
  ["12-25s", 12_000, 25_000],
  ["25-40s", 25_000, 40_000],
];

function seriesStats(values) {
  if (!values.length) return { n: 0, mean: null, std: null, min: null, max: null };
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / values.length;
  let dev = 0;
  for (const v of values) dev += (v - mean) ** 2;
  return {
    n: values.length,
    mean: round3(mean),
    std: round3(Math.sqrt(dev / values.length)),
    min: round3(min),
    max: round3(max),
  };
}

/**
 * 적응 지연 수렴 지표(A3). delayMs = 목표 지연(peerRenderDelayMs), renderLagMs = now − renderClock(실제 재생 지연).
 * convergeTimeMs = 지연이 mean(last 5s) ±20ms 안에 1s 이상 머문 최초 구간의 시작 시각(없으면 null).
 */
function delayConvergence(timeline) {
  const withDelay = timeline.filter((p) => typeof p.delayMs === "number");
  const windows = {};
  for (const [name, t0, t1] of DELAY_WINDOWS) {
    const sel = withDelay.filter((p) => p.tMs >= t0 && p.tMs < t1);
    windows[name] = {
      delayMs: seriesStats(sel.map((p) => p.delayMs)),
      renderLagMs: seriesStats(sel.filter((p) => typeof p.renderLagMs === "number").map((p) => p.renderLagMs)),
      gapEmaMs: seriesStats(sel.map((p) => p.gapEmaMs)),
    };
  }
  const late = withDelay.filter((p) => p.tMs >= 12_000 && p.tMs <= RUN_MS);
  const ppDelay = late.length
    ? Math.max(...late.map((p) => p.delayMs)) - Math.min(...late.map((p) => p.delayMs))
    : null;
  const lag = late.filter((p) => typeof p.renderLagMs === "number");
  const ppLag = lag.length
    ? Math.max(...lag.map((p) => p.renderLagMs)) - Math.min(...lag.map((p) => p.renderLagMs))
    : null;
  const tail = withDelay.filter((p) => p.tMs >= RUN_MS - 5_000);
  const target = tail.length ? tail.reduce((s, p) => s + p.delayMs, 0) / tail.length : null;
  let convergeTimeMs = null;
  if (target != null) {
    let runStart = null;
    for (const p of withDelay) {
      if (Math.abs(p.delayMs - target) <= 20) {
        if (runStart == null) runStart = p.tMs;
        if (p.tMs - runStart >= 1_000) {
          convergeTimeMs = Math.round(runStart);
          break;
        }
      } else {
        runStart = null;
      }
    }
  }
  return {
    windows,
    delayPp12to40Ms: ppDelay == null ? null : round3(ppDelay),
    renderLagPp12to40Ms: ppLag == null ? null : round3(ppLag),
    targetLast5sMeanMs: target == null ? null : round3(target),
    convergeTimeMs,
    note:
      "delayMs = integrator.peerRenderDelayMs(target); renderLagMs = nowMs − entity.renderClockMs. " +
      "converge = first t where delayMs stays within ±20ms of mean(last 5s) for 1s.",
  };
}

/**
 * @param {object} opts
 * @param {boolean} opts.enforceSpacingPp 생산 주기(≤200ms)만 간격 pp 게이트.
 *   1000ms 는 적응형 지연이 무지연 self 대비 평균 뒤처짐을 키워 pp 가 커진다(stamp 와 무관).
 */
function windowMetrics(timeline, t0, t1, opts = {}) {
  const enforceSpacingPp = opts.enforceSpacingPp !== false;
  const sample = timeline.filter((p) => p.tMs >= t0 && p.tMs <= t1);
  let minSpeed = Infinity;
  let maxSpeed = -Infinity;
  let maxBackM = 0;
  let maxJumpM = 0;
  let reverseFrames = 0;
  let teleportFrames = 0;
  const spacings = [];

  for (let i = 1; i < sample.length; i += 1) {
    const a = sample[i - 1];
    const b = sample[i];
    const dt = (b.tMs - a.tMs) / 1000;
    if (dt <= 0) continue;
    // entity.displayDistM 원본(반올림 없음) — debugSnapshot 0.1m 양자화 금지
    const v = (b.displayDistM - a.displayDistM) / dt;
    if (v < minSpeed) minSpeed = v;
    if (v > maxSpeed) maxSpeed = v;
    const back = a.displayDistM - b.displayDistM;
    if (back > maxBackM) maxBackM = back;
    if (back > BACK_EPS_M) reverseFrames += 1;
    const jump = Math.abs(b.displayDistM - a.displayDistM);
    if (jump > maxJumpM) maxJumpM = jump;
    if (jump > TELEPORT_FAIL_M) teleportFrames += 1;
    spacings.push(b.selfDistM - b.displayDistM);
  }

  let spacingMin = Infinity;
  let spacingMax = -Infinity;
  let spacingSum = 0;
  for (const s of spacings) {
    if (s < spacingMin) spacingMin = s;
    if (s > spacingMax) spacingMax = s;
    spacingSum += s;
  }
  const spacingMean = spacings.length ? spacingSum / spacings.length : 0;
  const spacingPpM = spacings.length ? spacingMax - spacingMin : 0;
  let spacingDevSum = 0;
  for (const s of spacings) spacingDevSum += (s - spacingMean) ** 2;
  const spacingStdM = spacings.length
    ? Math.sqrt(spacingDevSum / spacings.length)
    : 0;

  const speedLo = SPEED_MPS * (1 - SPEED_BAND_FRAC);
  const speedHi = SPEED_MPS * (1 + SPEED_BAND_FRAC);
  const violations = [];
  if (sample.length < 2) {
    violations.push("insufficient samples in window");
  } else {
    if (!(minSpeed > 0)) {
      violations.push(`screen speed reverse min=${minSpeed.toFixed(3)} m/s`);
    }
    if (!(maxSpeed <= speedHi + 0.01)) {
      violations.push(
        `screen speed max=${maxSpeed.toFixed(3)} > ${speedHi.toFixed(3)} m/s (±${SPEED_BAND_FRAC * 100}%)`,
      );
    }
    if (!(minSpeed >= speedLo - 0.01)) {
      violations.push(
        `screen speed min=${minSpeed.toFixed(3)} < ${speedLo.toFixed(3)} m/s (±${SPEED_BAND_FRAC * 100}%)`,
      );
    }
    if (enforceSpacingPp && spacingPpM > SPACING_PP_FAIL_M) {
      violations.push(
        `spacing peak-peak ${spacingPpM.toFixed(2)}m > ${SPACING_PP_FAIL_M}m`,
      );
    }
    if (reverseFrames > 0) {
      violations.push(`reverse frames=${reverseFrames} (back>${BACK_EPS_M}m)`);
    }
    if (teleportFrames > 0) {
      violations.push(`teleport frames=${teleportFrames} (jump>${TELEPORT_FAIL_M.toFixed(2)}m)`);
    }
  }

  return {
    minSpeedMps: Number.isFinite(minSpeed) ? round3(minSpeed) : null,
    maxSpeedMps: Number.isFinite(maxSpeed) ? round3(maxSpeed) : null,
    maxBackM: round3(maxBackM),
    maxJumpM: round3(maxJumpM),
    reverseFrames,
    teleportFrames,
    spacingMinM: spacings.length ? round3(spacingMin) : null,
    spacingMaxM: spacings.length ? round3(spacingMax) : null,
    spacingMeanM: spacings.length ? round3(spacingMean) : null,
    spacingPpM: round3(spacingPpM),
    spacingStdM: round3(spacingStdM),
    violations,
    pass: violations.length === 0,
  };
}

function analyze(timeline, ingestMeta, intervalMs) {
  // 간격 pp 게이트는 생산 주기(≤200ms). 1000ms 는 속도·역행·텔레포트만 게이트하고 pp 는 비교 기록.
  const enforceSpacingPp = intervalMs <= 200;
  const startup = windowMetrics(timeline, 0, STARTUP_MS, { enforceSpacingPp });
  const stable = windowMetrics(timeline, STABLE_START_MS, RUN_MS, { enforceSpacingPp });
  const stampedNowShare =
    ingestMeta.stampedCount === 0
      ? null
      : ingestMeta.stampedAsNowCount / ingestMeta.stampedCount;

  const policyConflict =
    intervalMs > RTDB_SOURCE_STALE_MS
      ? `interval ${intervalMs}ms > PEER_MOTION_RTDB_SOURCE_STALE_MS=${RTDB_SOURCE_STALE_MS}ms (반복 FS 전환·지원 범위 밖)`
      : null;

  // 게이트는 안정 구간. 시작 구간 위반은 별도 기록(숨기지 않음).
  const gatePass = policyConflict ? false : stable.pass;

  return {
    startup,
    stable,
    stampedNowShare: stampedNowShare == null ? null : round3(stampedNowShare),
    ingestAccepted: ingestMeta.accepted,
    syncCalls: ingestMeta.syncCalls,
    endDisplayDistM: timeline.at(-1)?.displayDistM ?? null,
    endSelfDistM: timeline.at(-1)?.selfDistM ?? null,
    policyConflict,
    // 호환 요약 필드 = 안정 구간
    minSpeedMps: stable.minSpeedMps,
    maxSpeedMps: stable.maxSpeedMps,
    maxBackM: stable.maxBackM,
    maxJumpM: stable.maxJumpM,
    reverseFrames: stable.reverseFrames,
    teleportFrames: stable.teleportFrames,
    spacingPpM: stable.spacingPpM,
    spacingStdM: stable.spacingStdM,
    spacingMeanM: stable.spacingMeanM,
    violations: [
      ...(policyConflict ? [policyConflict] : []),
      ...stable.violations.map((v) => `stable: ${v}`),
      ...startup.violations.map((v) => `startup: ${v}`),
    ],
    startupPass: startup.pass,
    stablePass: stable.pass,
    pass: gatePass,
  };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

async function runOne(mods, cfg) {
  const { mode, intervalMs, senderOffsetMs, jitterPattern, withSeq } = cfg;
  const { syncPeerMotionFromPresence, resetPeerMotionRtdbContentObservations } = mods.sync;
  const { getPeerMotionRegistry, resetPeerMotionRegistry } = mods.registry;

  resetPeerMotionRegistry();
  if (typeof resetPeerMotionRtdbContentObservations === "function") {
    resetPeerMotionRtdbContentObservations();
  }
  const reg = getPeerMotionRegistry();

  /** @type {Array<{captureMs:number, arriveAt:number, seq:number}>} */
  const arrivals = [];
  let k = 0;
  for (let t = intervalMs; t < RUN_MS; t += intervalMs) {
    k += 1;
    arrivals.push({
      captureMs: t,
      arriveAt: t + RTT_MS + delayAt(jitterPattern, k - 1, intervalMs),
      seq: k,
    });
  }
  arrivals.sort((a, b) => a.arriveAt - b.arriveAt || a.seq - b.seq);

  let motionRows = [];
  let liveRideRows = [];
  /** 수신된 마지막 RTDB capture — FS 는 이 이하만(미래 좌표 금지) */
  let lastArrivedCaptureMs = 0;
  let lastFsCaptureMs = 0;
  let nextFsAt = 0;
  let arrivalIdx = 0;
  const timeline = [];
  const ingestMeta = {
    accepted: 0,
    stampedCount: 0,
    stampedAsNowCount: 0,
    syncCalls: 0,
  };

  const realNow = Date.now;
  const realDebug = console.debug;
  const realInfo = console.info;
  const realLog = console.log;
  let clockMs = 0;
  Date.now = () => WALL_BASE_MS + clockMs;
  console.debug = (...args) => {
    if (String(args[0] ?? "").includes("[peerSyncChain]")) return;
    realDebug(...args);
  };
  console.info = (...args) => {
    const head = String(args[0] ?? "");
    if (head.includes("[peerAlive]") || head.includes("[peerSmooth]")) return;
    realInfo(...args);
  };
  console.log = (...args) => {
    const head = String(args[0] ?? "");
    if (head.includes("[peerSmooth]") || head.includes("[peerAlive]")) return;
    realLog(...args);
  };

  function callSync(nowMs) {
    syncPeerMotionFromPresence({
      publicationId: PUB,
      myUid: LOCAL_UID,
      motionRows,
      liveRideRows,
      sessionMembers: [{ uid: PEER_UID, displayName: "Peer", memberType: "member" }],
      guestUidsSorted: [],
      routeLenM: ROUTE_LEN_M,
      nowMs,
    });
    ingestMeta.syncCalls += 1;
  }

  function refreshFs(t) {
    if (mode !== "dual") {
      liveRideRows = [];
      return;
    }
    // FS capture ≤ 이미 도착한 RTDB — 수신 전 미래 좌표 금지
    const fsCap = lastArrivedCaptureMs > 0 ? lastArrivedCaptureMs : 0;
    if (fsCap <= 0) {
      liveRideRows = [];
      return;
    }
    if (t >= nextFsAt || liveRideRows.length === 0 || lastFsCaptureMs !== fsCap) {
      lastFsCaptureMs = fsCap;
      liveRideRows = [makeFsRow(lastFsCaptureMs, t)];
      if (t >= nextFsAt) nextFsAt = t + FS_INTERVAL_MS;
    } else {
      liveRideRows = [makeFsRow(lastFsCaptureMs, t)];
    }
  }

  try {
    for (let t = 0; t <= RUN_MS; t += STEP_MS) {
      clockMs = t;
      const nowMs = WALL_BASE_MS + t;

      // 한 프레임에 여러 도착 → 각각 sync(합쳐 없애지 않음)
      while (arrivalIdx < arrivals.length && arrivals[arrivalIdx].arriveAt <= t) {
        const a = arrivals[arrivalIdx];
        motionRows = [makeRtdbRow(a.captureMs, senderOffsetMs, a.seq, withSeq)];
        lastArrivedCaptureMs = a.captureMs;
        arrivalIdx += 1;
        ingestMeta.accepted += 1;
        refreshFs(t);
        callSync(nowMs);

        const entities = reg.entities;
        const entity = entities?.get?.(PEER_UID) ?? null;
        const newest = entity?.buffer?.[entity.buffer.length - 1];
        if (newest && motionRows[0]) {
          ingestMeta.stampedCount += 1;
          const origT = motionRows[0].serverAtMs;
          if (newest.serverAtMs !== origT && Math.abs(newest.serverAtMs - nowMs) < 1) {
            ingestMeta.stampedAsNowCount += 1;
          }
        }
      }

      refreshFs(t);
      // 프레임마다 Presence 재동기(FS receivedAt 갱신 등) — 도착 없는 프레임도 1회
      callSync(nowMs);
      reg.step(STEP_MS / 1000, null, nowMs);
      reg.pruneInactive(nowMs);

      const entities = reg.entities;
      const entity = entities?.get?.(PEER_UID) ?? null;
      const displayDistM =
        typeof entity?.displayDistM === "number" ? entity.displayDistM : 0;
      timeline.push({
        tMs: t,
        displayDistM,
        selfDistM: peerDistAt(t),
        entityCount: reg.getEntityCount(),
        ...(entity
          ? {
              gapEmaMs: entity.arrivalGapMsEma,
              delayMs: effectiveDelayMs(mods, entity),
              renderLagMs:
                typeof entity.renderClockMs === "number" ? nowMs - entity.renderClockMs : undefined,
            }
          : {}),
      });
    }
  } finally {
    Date.now = realNow;
    console.debug = realDebug;
    console.info = realInfo;
    console.log = realLog;
    resetPeerMotionRegistry();
    if (typeof resetPeerMotionRtdbContentObservations === "function") {
      resetPeerMotionRtdbContentObservations();
    }
  }

  const metrics = analyze(timeline, ingestMeta, intervalMs);
  metrics.delayConvergence = delayConvergence(timeline);
  return {
    mode,
    intervalMs,
    senderOffsetMs,
    jitterPattern,
    withSeq,
    speedMps: SPEED_MPS,
    timeline: cfg.keepTimeline ? timeline : undefined,
    ...metrics,
  };
}

function buildSpacingSvg(rows) {
  const W = 720;
  const H = 160;
  const PAD = { l: 48, r: 12, t: 18, b: 28 };
  const panels = rows
    .map((row, idx) => {
      const tl = row.timeline || [];
      let maxT = 1;
      let maxAbs = 1;
      for (const p of tl) {
        if (p.tMs > maxT) maxT = p.tMs;
        const sp = Math.abs(p.selfDistM - p.displayDistM);
        if (sp > maxAbs) maxAbs = sp;
      }
      const x = (t) => PAD.l + (t / maxT) * (W - PAD.l - PAD.r);
      const y = (s) => {
        const mid = (H - PAD.b + PAD.t) / 2;
        const amp = (H - PAD.t - PAD.b) / 2;
        return mid - (s / maxAbs) * amp;
      };
      const spacingPts = tl
        .map((p) => `${x(p.tMs).toFixed(1)},${y(p.selfDistM - p.displayDistM).toFixed(1)}`)
        .join(" ");
      const yTop = idx * (H + 10);
      const title = `${row.mode} int=${row.intervalMs} jit=${row.jitterPattern} off=${row.senderOffsetMs} pp=${row.spacingPpM}m spd=${row.minSpeedMps}..${row.maxSpeedMps}`;
      return `<g transform="translate(0 ${yTop})">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#0f1218" stroke="#232a35"/>
  <text x="${PAD.l}" y="12" fill="#e6edf3" font-size="10" font-family="monospace">${title}</text>
  <line x1="${PAD.l}" y1="${(H - PAD.b + PAD.t) / 2}" x2="${W - PAD.r}" y2="${(H - PAD.b + PAD.t) / 2}" stroke="#2b3341"/>
  <polyline points="${spacingPts}" fill="none" stroke="#4c8dff" stroke-width="1.2"/>
</g>`;
    })
    .join("");
  const totalH = rows.length * (H + 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
  <rect width="${W}" height="${totalH}" fill="#0b0e13"/>
  ${panels}
  <text x="48" y="${totalH - 4}" fill="#6b7480" font-size="9" font-family="monospace">blue=selfDist-peerDisplay (m) · zero line=mean lag</text>
</svg>`;
}

async function maybeWriteGraph(graphRows) {
  const svgPath = resolve(OUT_DIR, "peer-spacing-jitter.svg");
  const pngPath = resolve(OUT_DIR, "peer-spacing-jitter.png");
  const svg = buildSpacingSvg(graphRows);
  writeFileSync(svgPath, svg, "utf8");
  try {
    const { svgToPng } = await import("./graph.mjs");
    await svgToPng(svg, pngPath);
    console.log(`wrote ${pngPath}`);
  } catch (e) {
    console.log(`PNG skipped (${e?.message || e}); SVG at ${svgPath}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A2 — 소스 전환 결정적 시험: RTDB-only → dual(FS 등장) → FS-only(RTDB 침묵) → dual(RTDB 복귀)
// 실제 sync → Registry 경로. 20km/h 등속 송신, 200ms · sin 지터 · RTT 140.
// ───────────────────────────────────────────────────────────────────────────

const TRANSITION_RUN_MS = 84_000;
const TRANSITION_FS_APPEARS_MS = 20_000;
const TRANSITION_SILENCE_FROM_MS = 36_000;
const TRANSITION_SILENCE_TO_MS = 60_000;
/** 선택된 소스가 기대와 맞아야 하는 프레임 비율 — 전환이 실제로 일어났는지(공허한 PASS 방지) */
const TRANSITION_PICK_SHARE_MIN = 0.9;
/**
 * 구간별 안정 창 = [from + warmupMs, to]. warmup 은 전환 직후 stale 판정(RTDB 2.5s)·적응 지연 재수렴 구간이며
 * 이 구간도 `warmupWindow` 로 기록한다(숨기지 않음). 임계값(속도 ±20%·역행·순간이동)은 일반 게이트와 동일.
 */
const TRANSITION_PHASES = [
  { name: "rtdb-only", fromMs: 0, toMs: 20_000, warmupMs: 12_000, expectPick: "rtdb" },
  { name: "dual", fromMs: 20_000, toMs: 36_000, warmupMs: 4_000, expectPick: "rtdb" },
  // RTDB 침묵 36s → stale(2.5s) 후 ≈38.5s 에 FS 로 전환. 42s 부터 안정 창.
  { name: "fs-only", fromMs: 36_000, toMs: 60_000, warmupMs: 6_000, expectPick: "fs" },
  // RTDB 복귀 60s → 적응 지연이 2.2s→0.44s 로 재수렴하는 동안(≈3s)은 warmup.
  { name: "dual-again", fromMs: 60_000, toMs: 84_000, warmupMs: 6_000, expectPick: "rtdb" },
];

function installClockStubs(setClockRef) {
  const realNow = Date.now;
  const realDebug = console.debug;
  const realInfo = console.info;
  const realLog = console.log;
  Date.now = () => WALL_BASE_MS + setClockRef.clockMs;
  console.debug = (...args) => {
    if (String(args[0] ?? "").includes("[peerSyncChain]")) return;
    realDebug(...args);
  };
  console.info = (...args) => {
    const head = String(args[0] ?? "");
    if (head.includes("[peerAlive]") || head.includes("[peerSmooth]")) return;
    realInfo(...args);
  };
  console.log = (...args) => {
    const head = String(args[0] ?? "");
    if (head.includes("[peerSmooth]") || head.includes("[peerAlive]")) return;
    realLog(...args);
  };
  return () => {
    Date.now = realNow;
    console.debug = realDebug;
    console.info = realInfo;
    console.log = realLog;
  };
}

async function runTransition(mods, cfg) {
  const { senderOffsetMs, withSeq, silenceMode, fsIntervalMs } = cfg;
  const intervalMs = 200;
  const jitterPattern = "sin";
  const { syncPeerMotionFromPresence, resetPeerMotionRtdbContentObservations } = mods.sync;
  const { noteRtdbContentObservation, selectPeerMotionPacketForIngest } = mods.sync;
  const { getPeerMotionRegistry, resetPeerMotionRegistry } = mods.registry;

  resetPeerMotionRegistry();
  resetPeerMotionRtdbContentObservations?.();
  const reg = getPeerMotionRegistry();

  const arrivals = [];
  let k = 0;
  for (let t = intervalMs; t < TRANSITION_RUN_MS; t += intervalMs) {
    k += 1;
    arrivals.push({
      captureMs: t,
      arriveAt: t + RTT_MS + delayAt(jitterPattern, k - 1, intervalMs),
      seq: k,
    });
  }
  arrivals.sort((a, b) => a.arriveAt - b.arriveAt || a.seq - b.seq);

  let motionRows = [];
  let liveRideRows = [];
  let fsRow = null;
  let nextFsAt = TRANSITION_FS_APPEARS_MS;
  let arrivalIdx = 0;
  const timeline = [];
  const clockRef = { clockMs: 0 };
  const restore = installClockStubs(clockRef);

  function refreshFs(t) {
    if (t >= nextFsAt) {
      // FS 스냅샷: 도착 시각 − RTT 의 진짜 위치 (RTDB 침묵 중에도 계속 전진)
      fsRow = makeFsRow(Math.max(0, t - RTT_MS), t);
      nextFsAt = t + fsIntervalMs;
    }
    liveRideRows = fsRow ? [fsRow] : [];
  }
  function callSync(nowMs) {
    syncPeerMotionFromPresence({
      publicationId: PUB,
      myUid: LOCAL_UID,
      motionRows,
      liveRideRows,
      sessionMembers: [{ uid: PEER_UID, displayName: "Peer", memberType: "member" }],
      guestUidsSorted: [],
      routeLenM: ROUTE_LEN_M,
      nowMs,
    });
  }

  try {
    for (let t = 0; t <= TRANSITION_RUN_MS; t += STEP_MS) {
      clockRef.clockMs = t;
      const nowMs = WALL_BASE_MS + t;
      const silent = t >= TRANSITION_SILENCE_FROM_MS && t < TRANSITION_SILENCE_TO_MS;
      if (silent && silenceMode === "cleared") motionRows = [];

      while (arrivalIdx < arrivals.length && arrivals[arrivalIdx].arriveAt <= t) {
        const a = arrivals[arrivalIdx];
        arrivalIdx += 1;
        // 침묵 구간에 도착할 패킷은 유실(frozen: 마지막 행 재배달 · cleared: 행 없음)
        if (a.arriveAt >= TRANSITION_SILENCE_FROM_MS && a.arriveAt < TRANSITION_SILENCE_TO_MS) continue;
        motionRows = [makeRtdbRow(a.captureMs, senderOffsetMs, a.seq, withSeq)];
        refreshFs(t);
        callSync(nowMs);
      }

      refreshFs(t);
      callSync(nowMs);
      reg.step(STEP_MS / 1000, null, nowMs);
      reg.pruneInactive(nowMs);

      // 이 프레임에 어느 소스가 선택되었나(공허한 PASS 방지용 증거)
      let pick = "none";
      const rr = motionRows[0];
      const fr = liveRideRows[0];
      if (rr && fr) {
        const rtdbPkt = {
          uid: rr.uid,
          publicationId: PUB,
          distM: rr.distM,
          speedMps: rr.speedMps,
          phase: rr.ridePhase,
          serverAtMs: rr.serverAtMs,
        };
        const fsPkt = {
          uid: fr.uid,
          publicationId: PUB,
          distM: fr.distMeters,
          speedMps: fr.speedMps,
          phase: fr.ridePhase,
          serverAtMs: fr.lastSeenAtMs,
        };
        const changedAt = noteRtdbContentObservation(PEER_UID, rr, nowMs);
        pick = selectPeerMotionPacketForIngest(rtdbPkt, fsPkt, nowMs, changedAt) === fsPkt ? "fs" : "rtdb";
      } else if (fr) pick = "fs";
      else if (rr) pick = "rtdb";

      const entity = reg.entities?.get?.(PEER_UID) ?? null;
      timeline.push({
        tMs: t,
        displayDistM: typeof entity?.displayDistM === "number" ? entity.displayDistM : 0,
        selfDistM: peerDistAt(t),
        entityCount: reg.getEntityCount(),
        pick,
        ...(entity ? { gapEmaMs: entity.arrivalGapMsEma, delayMs: effectiveDelayMs(mods, entity) } : {}),
      });
    }
  } finally {
    restore();
    resetPeerMotionRegistry();
    resetPeerMotionRtdbContentObservations?.();
  }

  const phases = TRANSITION_PHASES.map((ph) => {
    const stableFrom = ph.fromMs + ph.warmupMs;
    const stable = windowMetrics(timeline, stableFrom, ph.toMs, { enforceSpacingPp: false });
    const warmup = windowMetrics(timeline, ph.fromMs, stableFrom, { enforceSpacingPp: false });
    const frames = timeline.filter((p) => p.tMs >= stableFrom && p.tMs <= ph.toMs);
    const pickShare = frames.length
      ? frames.filter((p) => p.pick === ph.expectPick).length / frames.length
      : 0;
    const violations = [...stable.violations];
    if (pickShare < TRANSITION_PICK_SHARE_MIN) {
      violations.push(
        `source ${ph.expectPick} share ${pickShare.toFixed(3)} < ${TRANSITION_PICK_SHARE_MIN} (전환이 일어나지 않음)`,
      );
    }
    if (frames.some((p) => p.entityCount !== 1)) {
      violations.push("peer entity missing/duplicated in stable window");
    }
    return {
      name: ph.name,
      stableFromMs: stableFrom,
      toMs: ph.toMs,
      expectPick: ph.expectPick,
      pickShare: round3(pickShare),
      stable,
      /** 참고용 — 게이트 아님. 전환 직후 과도 구간을 숨기지 않고 남긴다 */
      warmupWindow: {
        minSpeedMps: warmup.minSpeedMps,
        maxSpeedMps: warmup.maxSpeedMps,
        maxBackM: warmup.maxBackM,
        maxJumpM: warmup.maxJumpM,
        reverseFrames: warmup.reverseFrames,
        teleportFrames: warmup.teleportFrames,
      },
      violations,
      pass: violations.length === 0,
    };
  });

  // 초 단위 요약(참고) — 어느 초에 속도가 무너졌는지 JSON 에서 바로 보인다
  const perSecond = [];
  for (let s = 0; s * 1000 < TRANSITION_RUN_MS; s += 1) {
    const w = timeline.filter((p) => p.tMs >= s * 1000 && p.tMs < (s + 1) * 1000);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 1; i < w.length; i += 1) {
      const v = (w[i].displayDistM - w[i - 1].displayDistM) / ((w[i].tMs - w[i - 1].tMs) / 1000);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    perSecond.push({
      s,
      pick: w[w.length - 1]?.pick ?? null,
      minSpeedMps: Number.isFinite(lo) ? round3(lo) : null,
      maxSpeedMps: Number.isFinite(hi) ? round3(hi) : null,
      delayMs: w[w.length - 1]?.delayMs != null ? Math.round(w[w.length - 1].delayMs) : null,
      lagM: w.length ? round3(w[w.length - 1].selfDistM - w[w.length - 1].displayDistM) : null,
    });
  }

  const violations = phases.flatMap((p) => p.violations.map((v) => `${p.name}: ${v}`));
  return {
    senderOffsetMs,
    withSeq,
    silenceMode,
    fsIntervalMs,
    speedMps: SPEED_MPS,
    perSecond,
    phases,
    violations,
    pass: violations.length === 0,
  };
}

async function mainTransitions(args) {
  const server = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  const results = [];
  try {
    const mods = await loadMods(server);
    console.log(
      "peer-spacing transitions — rtdb-only → dual → fs-only → dual (sync→Registry, vite SSR)\n" +
        `SPEED=${SPEED_MPS.toFixed(3)} m/s FS=${args.fsIntervalMs}ms silence=[${TRANSITION_SILENCE_FROM_MS},${TRANSITION_SILENCE_TO_MS})ms ` +
        `thresholds: speed±${SPEED_BAND_FRAC * 100}% back>${BACK_EPS_M}m teleport>${TELEPORT_FAIL_M.toFixed(2)}m`,
    );
    const cells = [];
    for (const silenceMode of ["frozen", "cleared"]) {
      for (const senderOffsetMs of OFFSETS_MS) {
        cells.push({ senderOffsetMs, withSeq: true, silenceMode });
      }
    }
    cells.push({ senderOffsetMs: 0, withSeq: false, silenceMode: "frozen" });
    for (const c of cells) {
      const m = await runTransition(mods, { ...c, fsIntervalMs: args.fsIntervalMs });
      m.status = m.pass ? "pass" : "fail";
      results.push(m);
      const mark = m.pass ? "✓" : "✗";
      console.log(
        `${mark} off=${c.senderOffsetMs} silence=${c.silenceMode} seq=${c.withSeq ? "yes" : "no"} ` +
          m.phases
            .map(
              (p) =>
                `${p.name}[spd=${p.stable.minSpeedMps}..${p.stable.maxSpeedMps} back=${p.stable.maxBackM} jump=${p.stable.maxJumpM} pick=${p.pickShare}]`,
            )
            .join(" "),
      );
      for (const v of m.violations.slice(0, 8)) console.log(`    · ${v}`);
    }
  } finally {
    await server.close();
  }
  const failed = results.filter((r) => r.status === "fail").length;
  const report = {
    task: "20261005-peer-spacing-jitter A2 source transitions",
    at: new Date().toISOString(),
    note:
      "RTDB-only → dual → FS-only (RTDB frozen/cleared past stale) → dual. " +
      "Gate = stable window per phase (post-warmup); warmupWindow recorded separately. " +
      "FS interval 1s so speed band is meaningful (4s FS > 3s delay cap ⇒ extrapolate/hold is policy, not stamp). " +
      "Single-source packets also go through stampDualSourceIngestPacket (TASK-03 A2) so RTDB-only→dual keeps receiver axis.",
    phases: TRANSITION_PHASES,
    silenceFromMs: TRANSITION_SILENCE_FROM_MS,
    silenceToMs: TRANSITION_SILENCE_TO_MS,
    fsAppearsMs: TRANSITION_FS_APPEARS_MS,
    strict: args.strict,
    results,
    requiredFailCount: failed,
    requiredAllPass: failed === 0,
  };
  writeFileSync(args.jsonOut, JSON.stringify(report, null, 2), "utf8");
  console.log(
    `wrote ${args.jsonOut} (requiredFail=${failed} / ${results.length}` +
      `${args.strict ? " strict" : ""})`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

// ───────────────────────────────────────────────────────────────────────────
// 셀 목록 — 전체 행렬 / 게이트 / 지연 수렴 보고
// ───────────────────────────────────────────────────────────────────────────

/**
 * pre-push 게이트 셀 = 프로덕션 회귀 셀만(3000ms policyConflict 는 포함하지 않음).
 *  - dual × 200ms × 송신시계 ±30s/0 × 지터 none/sin/bundle (9)
 *  - single × 200ms × 0 × sin (baseline)
 *  - dual 200ms sin no-seq (production wire)
 */
function gateCells() {
  const cells = [];
  for (const senderOffsetMs of OFFSETS_MS) {
    for (const jitterPattern of ["none", "sin", "bundle"]) {
      cells.push({ mode: "dual", intervalMs: 200, senderOffsetMs, jitterPattern, withSeq: true });
    }
  }
  cells.push({ mode: "single", intervalMs: 200, senderOffsetMs: 0, jitterPattern: "sin", withSeq: true });
  cells.push({
    mode: "dual",
    intervalMs: 200,
    senderOffsetMs: 0,
    jitterPattern: "sin",
    withSeq: false,
    note: "no-seq production-like",
  });
  return cells;
}

function matrixCells(args) {
  const cells = [];
  for (const mode of args.modes) {
    for (const intervalMs of args.intervals) {
      for (const senderOffsetMs of args.offsets) {
        for (const jitterPattern of args.jitterPatterns) {
          cells.push({ mode, intervalMs, senderOffsetMs, jitterPattern, withSeq: args.withSeq });
        }
      }
    }
  }
  // 무seq 대조(프로덕션 wire) — dual 200ms sin 한 셀
  if (args.withSeq) {
    cells.push({
      mode: "dual",
      intervalMs: 200,
      senderOffsetMs: 0,
      jitterPattern: "sin",
      withSeq: false,
      note: "no-seq production-like",
    });
  }
  return cells;
}

function delayCells() {
  return [200, 1000].map((intervalMs) => ({
    mode: "dual",
    intervalMs,
    senderOffsetMs: 0,
    jitterPattern: "sin",
    withSeq: true,
  }));
}

function printDelayReport(m) {
  const dc = m.delayConvergence;
  if (!dc) return;
  console.log(
    `    delay ${m.mode} int=${m.intervalMs}ms: pp(12-40s)=${dc.delayPp12to40Ms}ms ` +
      `lagPp(12-40s)=${dc.renderLagPp12to40Ms}ms target(last5s)=${dc.targetLast5sMeanMs}ms ` +
      `convergeTime=${dc.convergeTimeMs ?? "never"}ms`,
  );
  for (const [name, w] of Object.entries(dc.windows)) {
    const d = w.delayMs;
    const l = w.renderLagMs;
    console.log(
      `      ${name.padEnd(7)} delay mean=${d.mean} std=${d.std} min=${d.min} max=${d.max} ` +
        `| renderLag mean=${l.mean} min=${l.min} max=${l.max} (gapEma mean=${w.gapEmaMs.mean})`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(args.jsonOut), { recursive: true });

  if (args.suite === "transitions") {
    await mainTransitions(args);
    return;
  }

  const server = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  const results = [];
  const graphRows = [];
  let requiredFailed = 0;
  let policyConflictCount = 0;
  try {
    const mods = await loadMods(server);
    console.log(
      `peer-spacing-jitter${args.gate ? " [GATE]" : args.suite ? ` [suite=${args.suite}]` : ""} — ` +
        "syncPeerMotionFromPresence + Registry (vite SSR)\n" +
        `SPEED=${SPEED_MPS.toFixed(3)} m/s (~20km/h) FS=${FS_INTERVAL_MS}ms ` +
        `stable≥${STABLE_START_MS}ms thresholds: spacingPp>${SPACING_PP_FAIL_M}m speed±${SPEED_BAND_FRAC * 100}%`,
    );

    const cells = args.gate ? gateCells() : args.suite === "delay" ? delayCells() : matrixCells(args);
    for (const cell of cells) {
      const { mode, intervalMs, senderOffsetMs, jitterPattern, withSeq } = cell;
      const keepTimeline =
        args.graph &&
        mode === "dual" &&
        withSeq &&
        (intervalMs === 200 || intervalMs === 1000) &&
        senderOffsetMs === 0 &&
        (jitterPattern === "sin" || jitterPattern === "bundle" || jitterPattern === "none");
      const m = await runOne(mods, { ...cell, keepTimeline });
      results.push(cell.note ? { ...m, note: cell.note } : m);
      if (keepTimeline && m.timeline) graphRows.push(m);
      // 게이트에서는 policyConflict 를 성공으로 치지 않는다(필수 실패로 집계)
      const mark = m.pass ? "✓" : m.policyConflict ? "◇" : "✗";
      console.log(
        `${mark} ${mode} int=${intervalMs}ms off=${senderOffsetMs} jit=${jitterPattern}${withSeq ? "" : " no-seq"} ` +
          `spd=${m.minSpeedMps}..${m.maxSpeedMps} ` +
          `spacePp=${m.spacingPpM}m std=${m.spacingStdM}m ` +
          `back=${m.maxBackM}m jump=${m.maxJumpM}m ` +
          `stampNow=${m.stampedNowShare ?? "n/a"} ` +
          `startup=${m.startupPass ? "ok" : "bad"}`,
      );
      // 시작 구간 위반은 게이트 아님 — JSON 에 전부 있고 콘솔은 한 줄로 요약(안정 구간 위반은 그대로 출력)
      const stableViolations = m.violations.filter((v) => !v.startsWith("startup:"));
      const startupCount = m.violations.length - stableViolations.length;
      for (const v of stableViolations.slice(0, 6)) console.log(`    · ${v}`);
      if (startupCount > 0 && !args.gate) console.log(`    · (startup 위반 ${startupCount}건 — 기록만, 게이트 아님)`);
      if (
        senderOffsetMs === 0 &&
        jitterPattern === "sin" &&
        withSeq &&
        (args.suite === "delay" || mode === "dual")
      ) {
        printDelayReport(m);
      }
      if (m.policyConflict) {
        policyConflictCount += 1;
        if (args.gate) requiredFailed += 1;
      } else if (!m.pass) requiredFailed += 1;
    }
  } finally {
    await server.close();
  }

  if (args.graph && graphRows.length) {
    await maybeWriteGraph(graphRows);
  }

  const dualFails = results.filter((r) => r.mode === "dual" && !r.pass && !r.policyConflict);
  const singleFails = results.filter((r) => r.mode === "single" && !r.pass && !r.policyConflict);
  const dualJitterFails = results.filter(
    (r) => r.mode === "dual" && r.jitterPattern !== "none" && !r.pass && !r.policyConflict,
  );
  const dual200 = results.filter((r) => r.mode === "dual" && r.intervalMs === 200 && !r.note);
  const single200 = results.filter((r) => r.mode === "single" && r.intervalMs === 200);

  const report = {
    task: "20261005-peer-spacing-jitter TASK-02",
    gate: args.gate,
    suite: args.suite || null,
    at: new Date().toISOString(),
    note:
      "All selected packets (RTDB-only / dual / FS-only) go through stampDualSourceIngestPacket. " +
      "Same source preserves native Δt; stamp map is kept across single↔dual. " +
      "Gate = stable window; startup recorded separately. " +
      "interval>RTDB_SOURCE_STALE is policyConflict (not forced PASS; counts as required fail in --gate). " +
      "spacing pp is NOT enforced for interval≥1000ms: adaptive delay ≈ gap×2.2 (~2200ms at 1s) makes " +
      "self(now)−peer(past) mean lag ≈ 12m at 20km/h — pp there is a delay-policy artefact, not a stamp-regression signal.",
    thresholds: {
      spacingPpFailM: SPACING_PP_FAIL_M,
      speedBandFrac: SPEED_BAND_FRAC,
      teleportFailM: TELEPORT_FAIL_M,
      backEpsM: BACK_EPS_M,
      startupMs: STARTUP_MS,
      stableStartMs: STABLE_START_MS,
      runMs: RUN_MS,
      rttMs: RTT_MS,
      fsIntervalMs: FS_INTERVAL_MS,
      rtdbSourceStaleMs: RTDB_SOURCE_STALE_MS,
    },
    summary: {
      total: results.length,
      requiredFailCount: requiredFailed,
      policyConflictCount,
      dualRequiredFailCount: dualFails.length,
      singleRequiredFailCount: singleFails.length,
      dualJitterRequiredFailCount: dualJitterFails.length,
      dual200Pass: dual200.every((r) => r.pass),
      single200Pass: single200.every((r) => r.pass),
      dual200MaxSpacePp: Math.max(...dual200.map((r) => r.spacingPpM ?? 0), 0),
      single200MaxSpacePp: Math.max(...single200.map((r) => r.spacingPpM ?? 0), 0),
    },
    results: results.map((r) => {
      const { timeline: _tl, ...rest } = r;
      return rest;
    }),
    requiredAllPass: requiredFailed === 0,
  };
  writeFileSync(args.jsonOut, JSON.stringify(report, null, 2), "utf8");
  console.log(
    `wrote ${args.jsonOut} (requiredFail=${requiredFailed} policyConflict=${policyConflictCount}; ` +
      `dual200MaxPp=${report.summary.dual200MaxSpacePp} single200MaxPp=${report.summary.single200MaxSpacePp})`,
  );
  if (args.gate) {
    console.log(requiredFailed === 0 ? "GATE PASS" : `GATE FAIL (requiredFail=${requiredFailed})`);
  }
  process.exit(requiredFailed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
