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

export const SCENARIOS = [cruise, accelDecel, stall, stationary, completed];
