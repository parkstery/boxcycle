import type { PeerMotionEntity, PeerMotionPacket } from "./types";
import {
  PEER_EXTRAP_LATENCY_MS,
  PEER_EXTRAP_MAX_AGE_MS,
  PEER_RECONCILE_CATCHUP_MPS,
  PEER_RECONCILE_SOFT_PULL_MPS,
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

export function resolvePacketSpeedMps(
  packet: PeerMotionPacket,
  prev: PeerMotionEntity | undefined,
): number {
  if (packet.speedMps > 0.02) return capSpeedMps(packet.speedMps);
  if (prev && packet.serverAtMs > prev.lastServerAtMs && prev.lastServerAtMs > 0) {
    const dtSec = (packet.serverAtMs - prev.lastServerAtMs) / 1000;
    if (dtSec > 0.04 && packet.distM >= prev.authDistM - DIST_EPS_M) {
      return capSpeedMps((packet.distM - prev.authDistM) / dtSec);
    }
  }
  if (prev && prev.speedMps > 0.02) return prev.speedMps;
  return 0;
}

/** ingest: displayDistM 은 create 시에만 authDistM — 이후 패킷은 velocity 만 갱신 */
export function applyPeerMotionIngest(
  entity: PeerMotionEntity,
  packet: PeerMotionPacket,
  label: string,
): void {
  const speed = resolvePacketSpeedMps(packet, entity);
  entity.label = label.slice(0, 48);
  entity.publicationId = packet.publicationId;
  entity.phase = packet.phase;
  entity.authDistM = packet.distM;
  entity.lastIngestLocalMs = Date.now();
  if (packet.serverAtMs > 0) entity.lastServerAtMs = packet.serverAtMs;

  const publishedSpeed = capSpeedMps(packet.speedMps);
  if (packet.phase === "live") {
    if (publishedSpeed > 0.02) {
      entity.speedMps = publishedSpeed;
    } else if (speed > 0.02) {
      entity.speedMps = speed;
    }
  } else if (packet.phase === "paused") {
    if (publishedSpeed > 0.02) entity.speedMps = publishedSpeed;
  }

  const spdForPedal =
    entity.speedMps > 0.02 ? entity.speedMps * 3.6 : speed > 0.02 ? speed * 3.6 : 0;
  if (spdForPedal > 0.38) {
    entity.pedalSpeedKmh = entity.pedalSpeedKmh * (1 - PEDAL_SPEED_EMA) + spdForPedal * PEDAL_SPEED_EMA;
  }
  if (packet.phase === "paused" || packet.phase === "completed") {
    entity.displayDistM = packet.distM;
    entity.speedMps = packet.phase === "completed" ? 0 : entity.speedMps;
  }
  // live: displayDistM 은 rAF step 이 추정 현재 위치(authDistM + speed×age)로 chase (P1)
}

export function createPeerMotionEntity(
  packet: PeerMotionPacket,
  label: string,
): PeerMotionEntity {
  const speed = capSpeedMps(packet.speedMps);
  return {
    uid: packet.uid,
    label: label.slice(0, 48),
    publicationId: packet.publicationId,
    phase: packet.phase,
    authDistM: packet.distM,
    speedMps: speed,
    displayDistM: packet.distM,
    lastServerAtMs: packet.serverAtMs,
    lastIngestLocalMs: Date.now(),
    reconcilePullMps: 0,
    hdg: 0,
    phaseRev: 0,
    pedalSpeedKmh: speed * 3.6,
  };
}

/**
 * rAF — display 를 **추정 현재 위치**로 chase (P1).
 * target = authDistM + speed × (수신 후 경과 + 지연상수). 샘플 당시 위치가 아니라
 * "지금쯤 peer 가 있을 위치"를 따라가므로, 가속한 peer 의 추월이 stale 갱신이어도 즉시 반영된다.
 * 시계 skew 와 무관(수신 측 lastIngestLocalMs 만 사용).
 */
export function stepPeerMotionEntity(
  entity: PeerMotionEntity,
  dtSec: number,
  routeLenM: number,
  nowMs: number = Date.now(),
): void {
  if (entity.phase === "paused" || entity.phase === "completed") {
    entity.displayDistM = clampRouteDist(entity.authDistM, routeLenM);
    return;
  }
  if (entity.phase !== "live") return;

  const ageSec = Math.min(
    PEER_EXTRAP_MAX_AGE_MS / 1000,
    Math.max(0, (nowMs - entity.lastIngestLocalMs) / 1000 + PEER_EXTRAP_LATENCY_MS / 1000),
  );
  const target = clampRouteDist(entity.authDistM + entity.speedMps * ageSec, routeLenM);
  const err = target - entity.displayDistM;

  if (err > DIST_EPS_M) {
    // 뒤처짐(추월 등) — peer 속도 + 따라잡기 여유로 빠르게, slew 제한으로 매끄럽게
    const maxStep = (entity.speedMps + PEER_RECONCILE_CATCHUP_MPS) * dtSec;
    entity.displayDistM = clampRouteDist(entity.displayDistM + Math.min(err, maxStep), routeLenM);
  } else if (err < -DIST_EPS_M) {
    // 앞섬(감속/정지) — 완만히 뒤로 정렬 (급격한 역주행 방지)
    const maxBack = PEER_RECONCILE_SOFT_PULL_MPS * dtSec;
    entity.displayDistM = clampRouteDist(entity.displayDistM + Math.max(err, -maxBack), routeLenM);
  } else {
    entity.displayDistM = clampRouteDist(target, routeLenM);
  }
}
