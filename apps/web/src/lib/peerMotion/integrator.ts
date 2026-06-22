import type { PeerMotionEntity, PeerMotionPacket } from "./types";
import { applyReconciliationOnIngest, applyReconciliationStep, applyDisplayCatchUpOnIngest } from "./reconciliation";

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
    entity.reconcilePullMps = 0;
  } else {
    applyDisplayCatchUpOnIngest(entity);
    applyReconciliationOnIngest(entity);
  }
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

/** rAF — displayDistM += speed × dt (패킷은 위치를 덮어쓰지 않음) */
export function stepPeerMotionEntity(
  entity: PeerMotionEntity,
  dtSec: number,
  routeLenM: number,
): void {
  if (entity.phase === "live" && entity.speedMps > 0.02) {
    entity.displayDistM = clampRouteDist(
      entity.displayDistM + entity.speedMps * dtSec,
      routeLenM,
    );
    applyReconciliationStep(entity, dtSec, routeLenM);
  } else if (entity.phase === "live") {
    applyReconciliationStep(entity, dtSec, routeLenM);
  } else if (entity.phase === "paused" || entity.phase === "completed") {
    entity.displayDistM = clampRouteDist(entity.authDistM, routeLenM);
  }
}
