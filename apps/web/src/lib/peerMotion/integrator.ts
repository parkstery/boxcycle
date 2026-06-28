import type { PeerMotionEntity, PeerMotionPacket, PeerMotionSnapshot } from "./types";
import {
  PEER_INTERP_BUFFER_MAX,
  PEER_INTERP_DELAY_MS,
  PEER_INTERP_MAX_EXTRAP_MS,
} from "../rideSyncPolicy";

const DIST_EPS_M = 0.2;
const MAX_SPEED_MPS = 85 / 3.6;
const PEDAL_SPEED_EMA = 0.35;

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
): void {
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
    return;
  }

  entity.buffer.push({
    distM: packet.distM,
    recvAtMs: now,
    serverAtMs: packet.serverAtMs,
    speedMps: entity.speedMps,
    phase: packet.phase,
  });
  if (entity.buffer.length > PEER_INTERP_BUFFER_MAX) entity.buffer.shift();
}

export function createPeerMotionEntity(
  packet: PeerMotionPacket,
  label: string,
): PeerMotionEntity {
  const now = Date.now();
  const speed = packet.phase === "completed" ? 0 : capSpeedMps(packet.speedMps);
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
        speedMps: speed,
        phase: packet.phase,
      },
    ],
    displayDistM: packet.distM,
    lastIngestLocalMs: now,
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
export function stepPeerMotionEntity(
  entity: PeerMotionEntity,
  _dtSec: number,
  routeLenM: number,
  nowMs: number = Date.now(),
): void {
  const buf = entity.buffer;
  if (buf.length === 0) return;

  const newest = buf[buf.length - 1]!;

  if (entity.phase === "paused" || entity.phase === "completed") {
    entity.displayDistM = clampRouteDist(newest.distM, routeLenM);
    return;
  }

  const renderTime = nowMs - PEER_INTERP_DELAY_MS;
  const oldest = buf[0]!;

  let dist: number;
  if (renderTime <= oldest.recvAtMs) {
    // 버퍼보다 과거 — 가장 오래된 위치 (방금 나타난 peer)
    dist = oldest.distM;
  } else if (renderTime >= newest.recvAtMs) {
    // 스트림 stall — newest 속도로 제한 외삽 후 hold
    const aheadMs = Math.min(renderTime - newest.recvAtMs, PEER_INTERP_MAX_EXTRAP_MS);
    dist = newest.distM + newest.speedMps * (aheadMs / 1000);
  } else {
    // renderTime 을 감싸는 두 스냅샷 보간
    let s0 = oldest;
    let s1 = newest;
    for (let i = 1; i < buf.length; i += 1) {
      if (buf[i]!.recvAtMs >= renderTime) {
        s1 = buf[i]!;
        s0 = buf[i - 1]!;
        break;
      }
    }
    const span = s1.recvAtMs - s0.recvAtMs;
    const t = span > 0 ? (renderTime - s0.recvAtMs) / span : 0;
    dist = s0.distM + (s1.distM - s0.distM) * t;
  }

  entity.displayDistM = clampRouteDist(dist, routeLenM);
}
