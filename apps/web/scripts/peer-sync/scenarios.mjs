// 재생 시나리오 — peer sync 알고리즘이 과거 어긴 패턴을 재현한다.
// 각 시나리오는 수신 측이 받은 패킷 이벤트 시퀀스. atMs = 수신 시계(Date.now) 기준.
//
// 새 실패를 만나면: 그 패킷 시퀀스를 여기 시나리오로 추가 → --check 가 회귀로 잡게 한다.
// (또는 실주행에서 캡처한 로그를 JSON 으로 --scenario <path> 로 넣는다.)

const PUB = "pub-test";
const UID = "peer-1";

/** 등속 전진 패킷 생성기 — RTDB 10Hz 가정. */
function steady({ startMs, count, intervalMs, startDistM, speedMps, phase = "live" }) {
  const events = [];
  for (let i = 0; i < count; i += 1) {
    const atMs = startMs + i * intervalMs;
    const distM = startDistM + speedMps * ((i * intervalMs) / 1000);
    events.push({
      atMs,
      packet: {
        uid: UID,
        publicationId: PUB,
        distM,
        speedMps,
        phase,
        serverAtMs: atMs,
      },
    });
  }
  return events;
}

// 1) 등속 순항 — 가장 기본. 역행·순간이동 없이 부드럽게 전진해야.
const cruise = {
  name: "cruise-steady",
  routeLenM: 2000,
  events: steady({ startMs: 10_000, count: 60, intervalMs: 100, startDistM: 0, speedMps: 8 }),
};

// 2) 급가속→급감속 — 보간이 외삽이면 여기서 고무줄/오버슛이 난다. 순간이동 없어야.
const accelDecel = {
  name: "accel-then-decel",
  routeLenM: 2000,
  events: (() => {
    const a = steady({ startMs: 10_000, count: 20, intervalMs: 100, startDistM: 0, speedMps: 4 });
    const last = a[a.length - 1];
    const b = steady({
      startMs: last.atMs + 100,
      count: 20,
      intervalMs: 100,
      startDistM: last.packet.distM,
      speedMps: 16,
    });
    const last2 = b[b.length - 1];
    const c = steady({
      startMs: last2.atMs + 100,
      count: 20,
      intervalMs: 100,
      startDistM: last2.packet.distM,
      speedMps: 2,
    });
    return [...a, ...b, ...c];
  })(),
};

// 3) 패킷 stall — 중간에 2.5s 끊김. 외삽 상한(PEER_INTERP_MAX_EXTRAP_MS) 이후 hold 되어야.
const stall = {
  name: "mid-stall-2500ms",
  routeLenM: 2000,
  events: (() => {
    const a = steady({ startMs: 10_000, count: 20, intervalMs: 100, startDistM: 0, speedMps: 8 });
    const last = a[a.length - 1];
    // 2.5s 공백 후 재개
    const b = steady({
      startMs: last.atMs + 2_500,
      count: 20,
      intervalMs: 100,
      startDistM: last.packet.distM + 8 * 2.5,
      speedMps: 8,
    });
    return [...a, ...b];
  })(),
};

// 4) 정체 패킷(dedup) — distM 안 늘고 같은 위치 반복. peer 가 멈추면 그 자리에 머물러야.
//
// FIXED(2026-07-22): 과거엔 멈춘 peer 가 ~7m 미끄러졌다(신호대기 오버슛). 원인 — 정지 패킷은
// dedup 으로 버퍼에 안 쌓여 newest 스냅샷 speedMps 가 정지 직전 주행값으로 남고, stall 외삽이
// 그 옛 속도로 PEER_INTERP_MAX_EXTRAP_MS 만큼 전진. 수정 — stepPeerMotionEntity 외삽이
// newest.speedMps 대신 entity.speedMps(dedup 되어도 매 ingest 갱신)를 쓰게 함(integrator.ts).
// 이 시나리오는 이제 그 회귀를 방어한다 — 오버슛이 다시 생기면 외삽상한 불변식이 잡는다.
const stationary = {
  name: "stationary-dedup",
  routeLenM: 2000,
  events: (() => {
    const a = steady({ startMs: 10_000, count: 15, intervalMs: 100, startDistM: 0, speedMps: 6 });
    const last = a[a.length - 1];
    // 같은 distM 을 20회 재전송(신호대기 등) — dedup 되어야
    const held = [];
    for (let i = 0; i < 20; i += 1) {
      const atMs = last.atMs + 100 + i * 200;
      held.push({
        atMs,
        packet: {
          uid: UID,
          publicationId: PUB,
          distM: last.packet.distM,
          speedMps: 0,
          phase: "live",
          serverAtMs: atMs,
        },
      });
    }
    return [...a, ...held];
  })(),
};

// 5) 완주 — 마지막에 completed. 완주 후 최종 위치 유지, 역행 없어야.
const completed = {
  name: "ride-to-completed",
  routeLenM: 500,
  events: (() => {
    const a = steady({ startMs: 10_000, count: 30, intervalMs: 100, startDistM: 400, speedMps: 8 });
    const last = a[a.length - 1];
    a.push({
      atMs: last.atMs + 100,
      packet: {
        uid: UID,
        publicationId: PUB,
        distM: 500,
        speedMps: 0,
        phase: "completed",
        serverAtMs: last.atMs + 100,
      },
    });
    return a;
  })(),
};

// ——— S2 §1-2 시나리오 5종 (증상 모델 · 불변식 회귀) ———
// 실측 D_eff/residual 재현은 s2-accuracy-gate.mjs (z15-cruise 실로그).

/** 출발 램프: 거리는 가속하는데 발행 speed 는 목표(8.3)로 고정 — D-1 외삽 과대 재현 */
const s2DepartRamp = {
  name: "s2-depart-ramp-target-speed",
  routeLenM: 2000,
  events: (() => {
    const events = [];
    let dist = 0;
    let v = 0; // 실제 속도 (램프)
    const target = 30 / 3.6;
    const startMs = 10_000;
    for (let i = 0; i < 120; i += 1) {
      const atMs = startMs + i * 200; // 실효 5Hz
      v = Math.min(target, v + target / (11.25 / 0.2)); // ~11.25s 램프
      dist += v * 0.2;
      events.push({
        atMs,
        packet: {
          uid: UID,
          publicationId: PUB,
          distM: dist,
          speedMps: target, // 버그: 목표속도 발행
          phase: "live",
          serverAtMs: atMs,
        },
      });
    }
    return events;
  })(),
};

/** 정속 30km/h · 실효 5Hz */
const s2Cruise30 = {
  name: "s2-cruise-30kmh",
  routeLenM: 2000,
  events: steady({
    startMs: 10_000,
    count: 100,
    intervalMs: 200,
    startDistM: 100,
    speedMps: 30 / 3.6,
  }),
};

/** 감속 30→5 */
const s2Decel = {
  name: "s2-decel-30-to-5",
  routeLenM: 2000,
  events: (() => {
    const a = steady({
      startMs: 10_000,
      count: 20,
      intervalMs: 200,
      startDistM: 200,
      speedMps: 30 / 3.6,
    });
    const last = a[a.length - 1];
    const b = steady({
      startMs: last.atMs + 200,
      count: 25,
      intervalMs: 200,
      startDistM: last.packet.distM,
      speedMps: 5 / 3.6,
    });
    return [...a, ...b];
  })(),
};

/** 일시정지 — dist 고정 · speed 0 */
const s2Pause = {
  name: "s2-pause-hold",
  routeLenM: 2000,
  events: (() => {
    const a = steady({
      startMs: 10_000,
      count: 15,
      intervalMs: 200,
      startDistM: 300,
      speedMps: 30 / 3.6,
    });
    const last = a[a.length - 1];
    const held = [];
    for (let i = 0; i < 50; i += 1) {
      const atMs = last.atMs + 200 + i * 200;
      held.push({
        atMs,
        packet: {
          uid: UID,
          publicationId: PUB,
          distM: last.packet.distM,
          speedMps: 0,
          phase: "live",
          serverAtMs: atMs,
        },
      });
    }
    return [...a, ...held];
  })(),
};

/**
 * 저줌(z≤14) 전환 — 패킷 공백 후 느린 5km/h 로 재개(D-2 spectator 속도 모델).
 * 재개 dist 는 공백 동안 고속 외삽이 갔을 위치에서 이어 역행을 만들지 않는다.
 */
const s2LowZoom = {
  name: "s2-lowzoom-stall-5kmh",
  routeLenM: 2000,
  events: (() => {
    const cruiseMps = 30 / 3.6;
    const a = steady({
      startMs: 10_000,
      count: 20,
      intervalMs: 200,
      startDistM: 400,
      speedMps: cruiseMps,
    });
    const last = a[a.length - 1];
    const gapSec = 2;
    const b = steady({
      startMs: last.atMs + gapSec * 1000,
      count: 30,
      intervalMs: 200,
      startDistM: last.packet.distM + cruiseMps * gapSec,
      speedMps: 5 / 3.6,
    });
    return [...a, ...b];
  })(),
};

/**
 * 5Hz(200ms) publish 후보 회귀 — 결정적 지터 + stop/start + 2s gap.
 * 기존 S2 200ms 케이스와 달리, 제안된 PEER_MOTION_PUBLISH_INTERVAL_MS=200 전환을
 * 수신 지터·정지·공백이 겹친 조건에서 보호한다. 발행 시계(serverAtMs/dist)는 200ms
 * 격자, atMs 만 고정 지터 패턴을 먹인다(비결정 난수 없음).
 */
const candidate5hzJitterGap = {
  name: "candidate-5hz-jitter-gap",
  routeLenM: 2000,
  events: (() => {
    const intervalMs = 200;
    const speedMps = 8;
    const baseRttMs = 40;
    // 고정 패턴: ± 지터(ms). 합이 0에 가깝게 두어 장기 드리프트를 만들지 않는다.
    const jitterMs = [0, 55, -35, 60, -25, 45, -50, 30];
    const events = [];
    let distM = 100;
    let pubMs = 10_000;
    let i = 0;

    const pushPub = (phase, speed) => {
      const jitter = jitterMs[i % jitterMs.length];
      const atMs = pubMs + baseRttMs + jitter;
      events.push({
        atMs,
        packet: {
          uid: UID,
          publicationId: PUB,
          distM,
          speedMps: speed,
          phase,
          serverAtMs: pubMs,
        },
      });
      i += 1;
      pubMs += intervalMs;
    };

    // 1) 정속 5Hz + 지터
    for (let k = 0; k < 40; k += 1) {
      pushPub("live", speedMps);
      distM += speedMps * (intervalMs / 1000);
    }

    // 2) stop/start — 마지막 발행 위치에 speed 0 을 몇 틱 보낸 뒤 재출발
    const heldDist = events[events.length - 1].packet.distM;
    distM = heldDist;
    for (let k = 0; k < 8; k += 1) {
      pushPub("live", 0);
    }
    for (let k = 0; k < 20; k += 1) {
      distM += speedMps * (intervalMs / 1000);
      pushPub("live", speedMps);
    }

    // 3) 2s 전송 공백 후 재개(거리는 공백 동안 등속 진행한 것으로 이어 역행을 만들지 않음)
    const last = events[events.length - 1];
    const gapMs = 2_000;
    pubMs = last.packet.serverAtMs + gapMs;
    distM = last.packet.distM + speedMps * (gapMs / 1000);
    for (let k = 0; k < 30; k += 1) {
      pushPub("live", speedMps);
      distM += speedMps * (intervalMs / 1000);
    }

    return events;
  })(),
};

// ——— TASK-24 / TASK-24R: 5Hz 품질 + 동일 절대 벽시계 모션의 10Hz/5Hz 쌍 ———
// 수신 측은 항상 "동행 1명" 스트림(2인 주행의 peer 표시). 솔로(1인) 동행 표시는 N/A.
// 제품 상수 변경 없음 — 패킷 간격만 100 vs 200 으로 동일 모션을 표본화.
//
// TASK-24R: 구간을 `last.packet.distM` / `last.atMs + gap` 으로 이으면 마지막 표본이
// (duration−interval) 에 있어 10Hz는 0.1s·5Hz는 0.2s 거리·시각이 어긋난다.
// 절대시각 piecewise 적분 + [t0,t1) 표본으로 공통 serverAtMs 격자에서 수치 일치.

/**
 * 절대시각 pieces 위에서 dist 적분. pieces 는 시간순·인접 [t0,t1).
 * emit:false 구간도 위치는 진행(무패킷 갭).
 */
function distAtWallMs(tMs, startDistM, pieces) {
  let d = startDistM;
  for (const p of pieces) {
    if (tMs <= p.t0) break;
    const end = Math.min(tMs, p.t1);
    if (end > p.t0) d += p.speedMps * ((end - p.t0) / 1000);
  }
  return d;
}

function speedAtWallMs(tMs, pieces) {
  for (const p of pieces) {
    if (tMs >= p.t0 && tMs < p.t1) return p.speedMps;
  }
  const last = pieces[pieces.length - 1];
  if (last && tMs === last.t1) return last.speedMps;
  return 0;
}

/**
 * 동일 절대 모션을 intervalMs 격자로 표본화.
 * 정지(speed≈0) 직후 재개 첫 표본은 dist 가 같아 integrator dedup 에 먹히므로,
 * rate 무관 최소 전진(0.1m)을 넣어 버퍼에 들어가게 한다 — 10Hz/5Hz 공통.
 * @param {{ startDistM: number, intervalMs: number, pieces: Array<{t0:number,t1:number,speedMps:number,emit?:boolean}>, recvAtMs?: (serverAtMs:number, index:number)=>number }} opts
 */
function sampleWallClockMotion({ startDistM, intervalMs, pieces, recvAtMs = null }) {
  const events = [];
  let index = 0;
  let lastEmittedDistM = Number.NEGATIVE_INFINITY;
  const DEDUP_EPS_M = 0.05;
  const RESUME_BUMP_M = 0.1; // > dedup 임계, interval 에 의존하지 않음
  for (const p of pieces) {
    if (p.emit === false) continue;
    for (let t = p.t0; t < p.t1; t += intervalMs) {
      const serverAtMs = t;
      const atMs = recvAtMs ? recvAtMs(serverAtMs, index) : serverAtMs;
      const speedMps = speedAtWallMs(serverAtMs, pieces);
      let distM = distAtWallMs(serverAtMs, startDistM, pieces);
      // 정지속 재개: 절대위치는 아직 동일 → 그대로내면 dup-same-dist 후 speed 만 살아
      // 외삽이 버퍼 newest(정지 시작) 기준으로 뛰었다가 다음 전진 패킷에 역행한다.
      if (speedMps > 0.02 && distM <= lastEmittedDistM + DEDUP_EPS_M) {
        distM = lastEmittedDistM + RESUME_BUMP_M;
      }
      events.push({
        atMs,
        packet: {
          uid: UID,
          publicationId: PUB,
          distM,
          speedMps,
          phase: "live",
          serverAtMs,
        },
      });
      lastEmittedDistM = distM;
      index += 1;
    }
  }
  return events;
}

/** 가속→감속 — 벽시계 2s×3, interval 만 100/200. */
function profileAccelDecel(intervalMs) {
  const t0 = 10_000;
  return sampleWallClockMotion({
    startDistM: 0,
    intervalMs,
    pieces: [
      { t0, t1: t0 + 2_000, speedMps: 4 },
      { t0: t0 + 2_000, t1: t0 + 4_000, speedMps: 16 },
      { t0: t0 + 4_000, t1: t0 + 6_000, speedMps: 2 },
    ],
  });
}

/**
 * 곡선 감속 언듈레이션 — 1D dist 상에서 커브 진입/탈출 속도 변화(8→3.5→8→3→8).
 * heading 필드는 패킷에 없으므로 속도 프로파일로만 재현.
 */
function profileCurveUndulation(intervalMs) {
  const t0 = 10_000;
  const segments = [
    { durationMs: 2_500, speedMps: 8 },
    { durationMs: 2_000, speedMps: 3.5 },
    { durationMs: 2_500, speedMps: 8 },
    { durationMs: 1_800, speedMps: 3 },
    { durationMs: 2_500, speedMps: 8 },
  ];
  const pieces = [];
  let t = t0;
  for (const seg of segments) {
    pieces.push({ t0: t, t1: t + seg.durationMs, speedMps: seg.speedMps });
    t += seg.durationMs;
  }
  return sampleWallClockMotion({ startDistM: 50, intervalMs, pieces });
}

/**
 * 재연결 — 정속 3s → 3s 무패킷 → 정속 3s 재개(갭 중 거리는 진행, 패킷만 없음).
 * 갭 절대시각은 interval 과 무관하게 [13000,16000).
 */
function profileReconnect(intervalMs, gapMs = 3_000) {
  const t0 = 10_000;
  const cruiseMs = 3_000;
  const speedMps = 8;
  return sampleWallClockMotion({
    startDistM: 100,
    intervalMs,
    pieces: [
      { t0, t1: t0 + cruiseMs, speedMps, emit: true },
      { t0: t0 + cruiseMs, t1: t0 + cruiseMs + gapMs, speedMps, emit: false },
      {
        t0: t0 + cruiseMs + gapMs,
        t1: t0 + cruiseMs + gapMs + cruiseMs,
        speedMps,
        emit: true,
      },
    ],
  });
}

/**
 * 지연(지터)+정지+공백 — 발행 절대시각 고정, interval 만 바꿈.
 * cruise 8s → stop 1.6s → resume 4s → gap 2s → resume 6s.
 * 갭 절대시각 [23600,25600). candidate-5hz-jitter-gap 은 별도 회귀 잠금(변경 금지).
 */
function profileJitterStopGap(intervalMs) {
  const t0 = 10_000;
  const speedMps = 8;
  const baseRttMs = 40;
  const jitterMs = [0, 55, -35, 60, -25, 45, -50, 30];
  const pieces = [
    { t0, t1: t0 + 8_000, speedMps },
    { t0: t0 + 8_000, t1: t0 + 9_600, speedMps: 0 },
    { t0: t0 + 9_600, t1: t0 + 13_600, speedMps },
    { t0: t0 + 13_600, t1: t0 + 15_600, speedMps, emit: false },
    { t0: t0 + 15_600, t1: t0 + 21_600, speedMps },
  ];
  return sampleWallClockMotion({
    startDistM: 100,
    intervalMs,
    pieces,
    recvAtMs: (serverAtMs, index) => serverAtMs + baseRttMs + jitterMs[index % jitterMs.length],
  });
}

/** 비교 쌍 메타 — 동등성 테스트·문서용. gaps = 무패킷 절대 구간 [start,end). */
export const CMP_RATE_PAIRS = [
  {
    name: "accel-decel",
    ten: "cmp-10hz-accel-decel",
    five: "cmp-5hz-accel-decel",
    phaseBoundsMs: [10_000, 12_000, 14_000, 16_000],
    gaps: [],
  },
  {
    name: "curve-undulation",
    ten: "cmp-10hz-curve-undulation",
    five: "cmp-5hz-curve-undulation",
    phaseBoundsMs: [10_000, 12_500, 14_500, 17_000, 18_800, 21_300],
    gaps: [],
  },
  {
    name: "reconnect-3s",
    ten: "cmp-10hz-reconnect-3s",
    five: "cmp-5hz-reconnect-3s",
    phaseBoundsMs: [10_000, 13_000, 16_000, 19_000],
    gaps: [{ startMs: 13_000, endMs: 16_000 }],
  },
  {
    name: "jitter-gap",
    ten: "cmp-10hz-jitter-gap",
    five: "cmp-5hz-jitter-gap",
    phaseBoundsMs: [10_000, 18_000, 19_600, 23_600, 25_600, 31_600],
    gaps: [{ startMs: 23_600, endMs: 25_600 }],
  },
];

const cmp10hzAccelDecel = {
  name: "cmp-10hz-accel-decel",
  routeLenM: 2000,
  events: profileAccelDecel(100),
};

const cmp5hzAccelDecel = {
  name: "cmp-5hz-accel-decel",
  routeLenM: 2000,
  events: profileAccelDecel(200),
};

const cmp10hzCurve = {
  name: "cmp-10hz-curve-undulation",
  routeLenM: 2000,
  events: profileCurveUndulation(100),
};

const cmp5hzCurve = {
  name: "cmp-5hz-curve-undulation",
  routeLenM: 2000,
  events: profileCurveUndulation(200),
};

const cmp10hzReconnect = {
  name: "cmp-10hz-reconnect-3s",
  routeLenM: 2000,
  events: profileReconnect(100),
};

const cmp5hzReconnect = {
  name: "cmp-5hz-reconnect-3s",
  routeLenM: 2000,
  events: profileReconnect(200),
};

const cmp10hzJitterGap = {
  name: "cmp-10hz-jitter-gap",
  routeLenM: 2000,
  events: profileJitterStopGap(100),
};

/** candidate-5hz-jitter-gap 은 TASK-04 회귀 잠금으로 유지. 동일 벽시계 비교용 5Hz 쌍. */
const cmp5hzJitterGap = {
  name: "cmp-5hz-jitter-gap",
  routeLenM: 2000,
  events: profileJitterStopGap(200),
};

/*
 * ── 사각 (2026-10-05 TASK-02) ──────────────────────────────────────
 * 주식 replay 는 이미 고른 단일 PeerMotionPacket 스트림만 ingest 한다.
 * 프로덕션 Presence 경로의 이중 소스 선택·stampDualSourceIngestPacket 은
 * 여기로 재생되지 않는다. 그 결함/회귀는 필수 게이트:
 *   node scripts/peer-sync/peer-spacing-jitter-harness.mjs
 * (RTDB freeze→FS 폴백·15s liveness 는 rtdb-fs-fallback-harness.mjs)
 */

export const SCENARIOS = [
  cruise,
  accelDecel,
  stall,
  stationary,
  completed,
  s2DepartRamp,
  s2Cruise30,
  s2Decel,
  s2Pause,
  s2LowZoom,
  candidate5hzJitterGap,
  cmp10hzAccelDecel,
  cmp5hzAccelDecel,
  cmp10hzCurve,
  cmp5hzCurve,
  cmp10hzReconnect,
  cmp5hzReconnect,
  cmp10hzJitterGap,
  cmp5hzJitterGap,
];
