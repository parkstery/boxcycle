import type { PeerMotionEntity, PeerMotionPacket, PeerMotionSnapshot } from "./types";
import {
  PEER_ARRIVAL_GAP_EMA,
  PEER_COMMON_DISPLAY_DELAY_MS,
  PEER_INTERP_BUFFER_MAX,
  PEER_INTERP_DELAY_GAP_FACTOR,
  PEER_INTERP_DELAY_MAX_MS,
  PEER_INTERP_DELAY_MS,
  PEER_INTERP_MAX_EXTRAP_MS,
  PEER_DISPLAY_CATCHUP_FACTOR,
  PEER_DISPLAY_MIN_CATCHUP_MPS,
  PEER_DISPLAY_SNAP_M,
  PEER_RENDER_CLOCK_CATCHUP_RATE,
  PEER_RENDER_CLOCK_RESYNC_MS,
} from "./peerSyncPolicy";

const DIST_EPS_M = 0.2;
const MAX_SPEED_MPS = 85 / 3.6;
const PEDAL_SPEED_EMA = 0.35;
/** 시계 오프셋이 위로 따라가는 속도 — 시계 드리프트만 흡수하고 지연 튐은 무시한다. */
const CLOCK_OFFSET_DRIFT = 0.01;

function packetHasServerTimeline(packet: PeerMotionPacket): boolean {
  return typeof packet.tSrv === "number" && Number.isFinite(packet.tSrv) && packet.tSrv > 0;
}

/** 패킷에서 쓸 수 있는 송신 시각만 꺼낸다. tSrv 우선(서버축). */
function readSrcAtMs(packet: PeerMotionPacket): number | null {
  if (packetHasServerTimeline(packet)) return packet.tSrv!;
  const t = packet.serverAtMs;
  return typeof t === "number" && Number.isFinite(t) && t > 0 ? t : null;
}

/**
 * 스냅샷이 **타임라인 위 어디에 놓이는가**(진단 코드도 반드시 이것을 쓴다 — 베끼면 거짓말한다)(내 시계 기준).
 *
 * 왜 도착 시각이 아닌가 — 송신자는 일정하게 달려도 패킷은 망 사정에 따라 몰려 오거나
 * 늦게 온다. 도착 시각을 시간축으로 쓰면 그 지터가 **그대로 속도 지터**가 된다.
 * 두 패킷이 20ms 차로 몰려 오면 그 사이 5m 를 20ms 에 간 것으로 그린다(250 m/s).
 * 송신 시각을 쓰면 간격이 송신자가 실제로 달린 시간과 같아진다.
 */
export function snapshotTimelineMs(entity: PeerMotionEntity, snap: PeerMotionSnapshot): number {
  if (snap.srcAtMs == null || entity.clockOffsetMs == null) return snap.recvAtMs;
  return snap.srcAtMs + entity.clockOffsetMs;
}

export type PeerMotionIngestResult =
  | "accepted"
  | "dup-same-dist"
  | "discard-forward"
  | "discard-retrograde";

export function clampRouteDist(distM: number, routeLenM: number): number {
  if (!Number.isFinite(distM)) return 0;
  if (routeLenM <= 0) return Math.max(0, distM);
  return Math.max(0, Math.min(routeLenM, distM));
}

export function capSpeedMps(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(MAX_SPEED_MPS, v));
}

/** 패킷 속도 — 미발행(0)이면 직전 스냅샷과의 거리/시간으로 유도 */
function resolveSpeedMps(
  packet: PeerMotionPacket,
  newest: PeerMotionSnapshot | undefined,
  recvAtMs: number,
): number {
  const published = capSpeedMps(packet.speedMps);
  if (published > 0.02) return published;
  if (newest && recvAtMs > newest.recvAtMs && packet.distM >= newest.distM - DIST_EPS_M) {
    const dtSec = (recvAtMs - newest.recvAtMs) / 1000;
    if (dtSec > 0.04) return capSpeedMps((packet.distM - newest.distM) / dtSec);
  }
  return newest?.speedMps ?? 0;
}

/** ingest — 위치 스냅샷을 버퍼에 push (보간 타임라인). 동일 송신 패킷 재수신은 dedup. */
export function applyPeerMotionIngest(
  entity: PeerMotionEntity,
  packet: PeerMotionPacket,
  label: string,
): PeerMotionIngestResult {
  const now = Date.now();
  entity.label = label.slice(0, 48);
  entity.publicationId = packet.publicationId;
  entity.phase = packet.phase;
  entity.lastIngestLocalMs = now;

  const newest = entity.buffer[entity.buffer.length - 1];

  // 속도는 항상 최신화 (외삽·페달 애니메이션). dedup 으로 스킵돼도 갱신.
  const speed = resolveSpeedMps(packet, newest, now);
  entity.speedMps = packet.phase === "completed" ? 0 : speed;

  const spdForPedal = entity.speedMps > 0.02 ? entity.speedMps * 3.6 : 0;
  if (spdForPedal > 0.38) {
    entity.pedalSpeedKmh = entity.pedalSpeedKmh * (1 - PEDAL_SPEED_EMA) + spdForPedal * PEDAL_SPEED_EMA;
  }

  // dedup 은 **distM 전진** 기준 — RTDB t 와 Firestore lastSeenAt 의 clock 혼용을 피한다.
  // (serverAtMs 로 dedup 하면 Firestore 시각이 앞설 때 5Hz RTDB 위치가 통째로 버려져
  //  버퍼가 듬성해지고 보간이 외삽으로 빠져 peer 가 느려 보이는 rate 오류 발생.)
  if (newest && packet.phase === "live" && packet.distM <= newest.distM + 0.05) {
    if (packet.distM > newest.distM + 1e-9) {
      // ≤0.05 m 전진인데 폐기 — 동일거리 취급 (게이트: 전진 폐기는 > newest 인데 버려진 경우만)
      return "dup-same-dist";
    }
    if (packet.distM < newest.distM - 0.05) return "discard-retrograde";
    return "dup-same-dist";
  }

  // 이론상 전진(> newest+0.05)은 여기 도달. 다른 경로로 버려지면 discard-forward.
  //
  // 도착 간격은 **버퍼에 실제로 쌓이는 것들** 사이로 잰다. dedup 으로 버려진 패킷은
  // 보간에 쓰이지 않으므로, 그것까지 세면 간격을 실제보다 짧게 보고 지연이 모자라진다.
  const srcAtMs = readSrcAtMs(packet);
  const serverTimeline = packetHasServerTimeline(packet);

  if (entity.serverTimeline !== serverTimeline) {
    // 서버축↔legacy 전환 — 혼합 버퍼 금지, 이번 패킷으로 rebase.
    entity.buffer.length = 0;
    entity.renderClockMs = null;
    entity.lastStepNowMs = serverTimeline ? 0 : now;
    entity.arrivalGapMsEma = 0;
    entity.clockOffsetMs = null;
  }
  entity.serverTimeline = serverTimeline;

  if (serverTimeline) {
    // 서버축 — clockOffset 으로 수신축에 끌어오지 않는다(공통 D 붕괴 방지).
    entity.clockOffsetMs = 0;
  } else if (srcAtMs != null) {
    const off = now - srcAtMs;
    const prevOff = entity.clockOffsetMs;
    const nextOff =
      prevOff == null || off < prevOff ? off : prevOff + (off - prevOff) * CLOCK_OFFSET_DRIFT;
    /*
     * ⚠️ 오프셋이 바뀌면 **버퍼의 모든 스냅샷이 타임라인 위에서 그만큼 통째로 이동한다**
     * (타임라인 = 송신시각 + 오프셋). 재생 시계를 그대로 두면 그 차이만큼 화면이 건너뛴다.
     * 같은 양만큼 재생 시계도 옮겨 **상대 위치를 보존**한다 — 그러면 갱신이 보이지 않는다.
     * 어긋난 만큼은 뒤에서 천천히(±10%) 제자리를 찾는다.
     */
    if (prevOff != null && entity.renderClockMs != null) {
      entity.renderClockMs += nextOff - prevOff;
    }
    entity.clockOffsetMs = nextOff;
  }

  if (newest) {
    const gap = now - newest.recvAtMs;
    if (gap > 0 && gap < 30_000) {
      entity.arrivalGapMsEma =
        entity.arrivalGapMsEma > 0
          ? entity.arrivalGapMsEma * (1 - PEER_ARRIVAL_GAP_EMA) + gap * PEER_ARRIVAL_GAP_EMA
          : gap;
    }
  }

  entity.buffer.push({
    distM: packet.distM,
    recvAtMs: now,
    serverAtMs: packet.serverAtMs,
    srcAtMs,
    speedMps: entity.speedMps,
    phase: packet.phase,
    ...(packet.seq != null ? { seq: packet.seq } : {}),
  });
  if (entity.buffer.length > PEER_INTERP_BUFFER_MAX) entity.buffer.shift();
  return "accepted";
}

export function createPeerMotionEntity(
  packet: PeerMotionPacket,
  label: string,
): PeerMotionEntity {
  const now = Date.now();
  const speed = packet.phase === "completed" ? 0 : capSpeedMps(packet.speedMps);
  const serverTimeline = packetHasServerTimeline(packet);
  const srcAtMs = readSrcAtMs(packet);
  return {
    uid: packet.uid,
    label: label.slice(0, 48),
    publicationId: packet.publicationId,
    phase: packet.phase,
    speedMps: speed,
    buffer: [
      {
        distM: packet.distM,
        recvAtMs: now,
        serverAtMs: packet.serverAtMs,
        srcAtMs,
        speedMps: speed,
        phase: packet.phase,
        ...(packet.seq != null ? { seq: packet.seq } : {}),
      },
    ],
    displayDistM: packet.distM,
    lastIngestLocalMs: now,
    arrivalGapMsEma: 0,
    renderClockMs: null,
    lastStepNowMs: serverTimeline ? 0 : now,
    serverTimeline,
    clockOffsetMs: serverTimeline ? 0 : srcAtMs == null ? null : now - srcAtMs,
    hdg: 0,
    phaseRev: 0,
    pedalSpeedKmh: speed * 3.6,
  };
}

/**
 * rAF — entity interpolation.
 * peer 를 `now - DELAY` 시점으로 렌더한다: 그 시점을 감싸는 두 스냅샷 사이를 **보간**한다.
 * 외삽(미래 추측)이 아니라 받은 위치들 사이만 그리므로 가속/감속에 고무줄·지연이 없고,
 * 추월이 정확히(약 DELAY 만큼 뒤지지만 정확하게) 재생된다. recvAtMs(수신 측 시계)만 써서 clock skew 무관.
 * 스트림이 DELAY 보다 더 끊기면 newest 속도로 짧게 외삽 후 hold (지터·Firestore 폴백 완충).
 */
/**
 * 이 동행을 **얼마나 과거로** 재생할 것인가(ms).
 *
 * 보간이 성립하려면 재생 시점이 **항상 최신 스냅샷보다 과거**여야 한다. 그러려면 지연이
 * 도착 간격보다 넉넉히 길어야 한다. 짧으면 코드는 매 프레임 「최신 위치 + 속도 × 시간」을
 * 추측하다가 새 패킷이 오는 순간 **그 오차만큼 순간이동**한다 — 보간이 아니라 스냅이다.
 *
 * 아직 간격을 모르면(첫 패킷) 하한을 쓴다. 상한을 두는 이유는 지연이 곧 「동행이 뒤처져
 * 보이는 시간」이기 때문이다.
 */
export function peerRenderDelayMs(entity: PeerMotionEntity): number {
  // 서버축(tSrv) 동행 — 창별 gap EMA 금지, 고정 공통 D.
  if (entity.serverTimeline) return PEER_COMMON_DISPLAY_DELAY_MS;
  const gap = entity.arrivalGapMsEma;
  if (!(gap > 0)) return PEER_INTERP_DELAY_MS;
  const want = gap * PEER_INTERP_DELAY_GAP_FACTOR;
  return Math.max(PEER_INTERP_DELAY_MS, Math.min(PEER_INTERP_DELAY_MAX_MS, want));
}

/**
 * 재생 시계를 한 프레임 전진시키고, 목표 지연 쪽으로 **조금씩만** 당긴다.
 *
 * 목표가 흔들려도(도착 간격 추정이 바뀌어도) 화면은 흔들리지 않는다 — 그것이 요점이다.
 * 반환값이 이번 프레임에 그릴 시점이다.
 */
function advancePeerRenderClock(entity: PeerMotionEntity, nowMs: number): number {
  const target = nowMs - peerRenderDelayMs(entity);
  const dtMs = Math.max(0, Math.min(1_000, nowMs - entity.lastStepNowMs));
  entity.lastStepNowMs = nowMs;

  if (entity.renderClockMs == null) {
    entity.renderClockMs = target;
    return target;
  }

  let clock = entity.renderClockMs + dtMs;
  const err = target - clock;
  if (Math.abs(err) > PEER_RENDER_CLOCK_RESYNC_MS) {
    clock = target;
  } else {
    const maxStep = dtMs * PEER_RENDER_CLOCK_CATCHUP_RATE;
    clock += Math.max(-maxStep, Math.min(maxStep, err));
  }
  entity.renderClockMs = clock;
  return clock;
}

/**
 * 지금 화면에 그리고 있는 **재생 시점**. 진단·로그는 이것을 봐야 한다.
 *
 * ⚠️ `nowMs - PEER_INTERP_DELAY_MS` 로 다시 계산하면 안 된다. 제품은 재생 시계를 따로
 * 굴리므로 값이 다르고, 그러면 로그가 「외삽 중」이라고 **거짓말한다**.
 */
export function peerRenderTimeMs(entity: PeerMotionEntity, nowMs: number): number {
  return entity.renderClockMs ?? nowMs - peerRenderDelayMs(entity);
}

export function stepPeerMotionEntity(
  entity: PeerMotionEntity,
  _dtSec: number,
  routeLenM: number,
  nowMs: number = Date.now(),
  opts?: { lockedRenderTimeMs?: number },
): void {
  const buf = entity.buffer;
  if (buf.length === 0) return;

  const newest = buf[buf.length - 1]!;

  // 구버전/수신축 — paused/completed 는 newest 스냅(기존 liveness 계약).
  // 서버축은 capture 시점 보간을 유지해 self D=600 과 불일치·튐을 막는다.
  if (
    !entity.serverTimeline &&
    (entity.phase === "paused" || entity.phase === "completed")
  ) {
    entity.displayDistM = clampRouteDist(newest.distM, routeLenM);
    // 멈춰 있는 동안에도 재생 시계는 따라가게 둔다 — 다시 달릴 때 몰아서 따라잡지 않게.
    entity.renderClockMs = nowMs - peerRenderDelayMs(entity);
    entity.lastStepNowMs = nowMs;
    return;
  }

  const dtMs = Math.max(0, Math.min(1_000, nowMs - entity.lastStepNowMs));
  let renderTime: number;
  if (
    typeof opts?.lockedRenderTimeMs === "number" &&
    Number.isFinite(opts.lockedRenderTimeMs)
  ) {
    // 공통 frame renderTime — self/카메라와 동일 시각(별도 entity catch-up 금지).
    renderTime = opts.lockedRenderTimeMs;
    entity.renderClockMs = renderTime;
    entity.lastStepNowMs = nowMs;
  } else {
    renderTime = advancePeerRenderClock(entity, nowMs);
  }
  const oldest = buf[0]!;

  const newestT = snapshotTimelineMs(entity, newest);
  const oldestT = snapshotTimelineMs(entity, oldest);

  let dist: number;
  if (renderTime <= oldestT) {
    // 버퍼보다 과거 — 가장 오래된 위치 (방금 나타난 peer)
    dist = oldest.distM;
  } else if (renderTime >= newestT) {
    // 스트림 stall — **entity.speedMps**(항상 최신) 로 제한 외삽 후 hold.
    // newest.speedMps(버퍼 스냅샷) 를 쓰면 안 된다: 정지 패킷(distM 불변)은 dedup 으로 버퍼에
    // 안 쌓여 newest 가 정지 직전 전진 스냅샷에 고정되고, 그 옛 속도로 외삽해 멈춘 peer 가
    // ~7m 미끄러진다(신호대기 오버슛). entity.speedMps 는 dedup 되어도 매 ingest 갱신되므로
    // 정지가 즉시 반영된다.
    // 서버축 paused/completed 는 capture 시점 hold(0) — newest 위치 즉시 snap 금지.
    const pausedHold =
      entity.serverTimeline &&
      (newest.phase === "paused" || newest.phase === "completed");
    const extrapSpeed = pausedHold ? 0 : entity.speedMps;
    const aheadMs = Math.min(renderTime - newestT, PEER_INTERP_MAX_EXTRAP_MS);
    dist = newest.distM + extrapSpeed * (aheadMs / 1000);
  } else {
    // renderTime 을 감싸는 두 스냅샷 보간
    let s0 = oldest;
    let s1 = newest;
    for (let i = 1; i < buf.length; i += 1) {
      if (snapshotTimelineMs(entity, buf[i]!) >= renderTime) {
        s1 = buf[i]!;
        s0 = buf[i - 1]!;
        break;
      }
    }
    const t0 = snapshotTimelineMs(entity, s0);
    const span = snapshotTimelineMs(entity, s1) - t0;
    const t = span > 0 ? (renderTime - t0) / span : 0;
    dist = s0.distM + (s1.distM - s0.distM) * t;
  }

  entity.displayDistM = applyPeerDisplayCorrection(
    entity,
    clampRouteDist(dist, routeLenM),
    dtMs,
  );
}

/**
 * 계산된 위치로 **한 번에 건너뛰지 않는다** — 제 속도의 몇 배까지만 따라간다.
 *
 * 왜 원인마다 쫓지 않는가 — 실주행 계측에서 튐은 **0.5~0.8% 의 프레임**에만 나타났고
 * (최대 51 m/s), 원인이 여럿일 수 있다(시계 오프셋 갱신·버퍼 밀림·외삽에서 보간으로 전환).
 * 하나씩 쫓으면 늘 하나가 남는다. **출구 한 곳에 한도를 걸면 무엇이 원인이든 보이지 않는다.**
 *
 * ⚠️ 이것은 위치를 **지연**시킬 뿐 버리지 않는다. 어긋난 만큼은 다음 프레임들에서 따라잡는다.
 * 진짜 순간이동(재참여·경로 재시작)은 `PEER_DISPLAY_SNAP_M` 을 넘으므로 즉시 맞춘다.
 */
function applyPeerDisplayCorrection(
  entity: PeerMotionEntity,
  targetDistM: number,
  dtMs: number,
): number {
  const prev = entity.displayDistM;
  if (!Number.isFinite(prev) || dtMs <= 0) return targetDistM;

  const err = targetDistM - prev;
  if (Math.abs(err) > PEER_DISPLAY_SNAP_M) return targetDistM;

  const catchUpMps = Math.max(
    entity.speedMps * PEER_DISPLAY_CATCHUP_FACTOR,
    PEER_DISPLAY_MIN_CATCHUP_MPS,
  );
  const maxStep = catchUpMps * (dtMs / 1000);
  if (Math.abs(err) <= maxStep) return targetDistM;
  return prev + (err > 0 ? maxStep : -maxStep);
}
