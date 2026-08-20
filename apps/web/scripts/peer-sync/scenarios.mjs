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
 * S4-5 ② — 송신은 100 ms 격자 등속, 도착만 50·150 ms 로 흔든다.
 * 기존 시나리오·불변식은 그대로. 시나리오 전용 게이트(구간 속도)가 수정 전 fail 이어야 한다.
 */
const recvJitter50150 = {
  name: "recv-jitter-50-150",
  routeLenM: 2000,
  stepIntervalMs: 10,
  recvJitter: {
    sendSpeedMps: 5 / 3.6,
    maxRelSpeedErr: 0.15,
  },
  gapPx: {
    pxPerM: 29.2,
    sendSpeedMps: 5 / 3.6,
    selfStartDistM: 0,
  },
  events: (() => {
    const startMs = 10_000;
    const count = 80;
    const sendIntervalMs = 100;
    const speedMps = 5 / 3.6;
    const arrivals = [50, 150];
    const events = [];
    let recvAt = startMs;
    for (let i = 0; i < count; i += 1) {
      if (i > 0) recvAt += arrivals[(i - 1) % 2];
      const serverAtMs = startMs + i * sendIntervalMs;
      events.push({
        atMs: recvAt,
        packet: {
          uid: UID,
          publicationId: PUB,
          distM: speedMps * ((i * sendIntervalMs) / 1000),
          speedMps,
          phase: "live",
          serverAtMs,
          seq: i + 1,
        },
      });
    }
    return events;
  })(),
};

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
  recvJitter50150,
];
