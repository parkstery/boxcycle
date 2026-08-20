import type { PeerMotionEntity, PeerMotionPacket, PeerMotionSnapshot } from "./types";
import {
  PEER_INTERP_BUFFER_MAX,
  PEER_INTERP_DELAY_MS,
  PEER_INTERP_MAX_EXTRAP_MS,
} from "../rideSyncPolicy";

const DIST_EPS_M = 0.2;
const MAX_SPEED_MPS = 85 / 3.6;
const PEDAL_SPEED_EMA = 0.35;
/** offset = EMA(recvAtMs − serverAtMs). DELAY/BUFFER/EXTRAP 상수는 그대로. */
const CLOCK_OFFSET_EMA = 0.2;

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

export function isUsableServerAtMs(ms: number): boolean {
  return Number.isFinite(ms) && ms > 0;
}

function noteClockOffset(entity: PeerMotionEntity, recvAtMs: number, serverAtMs: number): void {
  if (!isUsableServerAtMs(serverAtMs)) return;
  const sample = recvAtMs - serverAtMs;
  if (!Number.isFinite(entity.clockOffsetMs)) {
    entity.clockOffsetMs = sample;
    return;
  }
  entity.clockOffsetMs =
    CLOCK_OFFSET_EMA * sample + (1 - CLOCK_OFFSET_EMA) * entity.clockOffsetMs;
}

function bufferUsesServerAxis(buf: readonly PeerMotionSnapshot[]): boolean {
  if (buf.length === 0) return false;
  for (const s of buf) {
    if (!isUsableServerAtMs(s.serverAtMs)) return false;
  }
  for (let i = 1; i < buf.length; i += 1) {
    if (buf[i]!.serverAtMs <= buf[i - 1]!.serverAtMs) return false;
  }
  return true;
}

function axisTimeMs(snap: PeerMotionSnapshot, useServer: boolean): number {
  return useServer ? snap.serverAtMs : snap.recvAtMs;
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
  noteClockOffset(entity, now, packet.serverAtMs);

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
  entity.buffer.push({
    distM: packet.distM,
    recvAtMs: now,
    serverAtMs: packet.serverAtMs,
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
  const clockOffsetMs = isUsableServerAtMs(packet.serverAtMs) ? now - packet.serverAtMs : 0;
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
        ...(packet.seq != null ? { seq: packet.seq } : {}),
      },
    ],
    clockOffsetMs,
    serverAxisFallbackCount: 0,
    displayDistM: packet.distM,
    lastIngestLocalMs: now,
    hdg: 0,
    phaseRev: 0,
    pedalSpeedKmh: speed * 3.6,
  };
}

export type PeerMotionStepPlan = {
  distM: number;
  mode: "paused" | "oldest" | "interpolate" | "extrapolate";
  usedServerAxis: boolean;
  renderTime: number;
  aheadMs: number | null;
  s0: PeerMotionSnapshot | null;
  s1: PeerMotionSnapshot | null;
  t: number | null;
};

/**
 * rAF — entity interpolation.
 * 보간 축은 송신 serverAtMs. offset = EMA(recv − server),
 * renderTime = (now − offset) − PEER_INTERP_DELAY_MS.
 * serverAtMs 가 0·없음·비단조면 그 스텝은 recvAtMs 로 폴백한다.
 * stall 외삽은 **entity.speedMps**(항상 최신). newest.speedMps 로 되돌리면 정지 오버슛 7.2m 재발.
 */
export function planPeerMotionStep(
  entity: PeerMotionEntity,
  nowMs: number,
): PeerMotionStepPlan {
  const buf = entity.buffer;
  const newest = buf[buf.length - 1]!;
  const oldest = buf[0]!;

  if (entity.phase === "paused" || entity.phase === "completed") {
    return {
      distM: newest.distM,
      mode: "paused",
      usedServerAxis: false,
      renderTime: nowMs,
      aheadMs: null,
      s0: null,
      s1: null,
      t: null,
    };
  }

  const useServer = bufferUsesServerAxis(buf);
  const offset = useServer && Number.isFinite(entity.clockOffsetMs) ? entity.clockOffsetMs : 0;
  const renderTime = useServer
    ? nowMs - offset - PEER_INTERP_DELAY_MS
    : nowMs - PEER_INTERP_DELAY_MS;
  const oldestT = axisTimeMs(oldest, useServer);
  const newestT = axisTimeMs(newest, useServer);

  if (renderTime <= oldestT) {
    return {
      distM: oldest.distM,
      mode: "oldest",
      usedServerAxis: useServer,
      renderTime,
      aheadMs: null,
      s0: oldest,
      s1: null,
      t: null,
    };
  }

  if (renderTime >= newestT) {
    // 스트림 stall — **entity.speedMps**(항상 최신) 로 제한 외삽 후 hold.
    // newest.speedMps(버퍼 스냅샷) 를 쓰면 안 된다: 정지 패킷(distM 불변)은 dedup 으로 버퍼에
    // 안 쌓여 newest 가 정지 직전 전진 스냅샷에 고정되고, 그 옛 속도로 외삽해 멈춘 peer 가
    // ~7m 미끄러진다(신호대기 오버슛). entity.speedMps 는 dedup 되어도 매 ingest 갱신되므로
    // 정지가 즉시 반영된다.
    const aheadRaw = renderTime - newestT;
    const aheadMs = Math.min(aheadRaw, PEER_INTERP_MAX_EXTRAP_MS);
    return {
      distM: newest.distM + entity.speedMps * (aheadMs / 1000),
      mode: "extrapolate",
      usedServerAxis: useServer,
      renderTime,
      aheadMs,
      s0: newest,
      s1: null,
      t: null,
    };
  }

  let s0 = oldest;
  let s1 = newest;
  for (let i = 1; i < buf.length; i += 1) {
    if (axisTimeMs(buf[i]!, useServer) >= renderTime) {
      s1 = buf[i]!;
      s0 = buf[i - 1]!;
      break;
    }
  }
  const span = axisTimeMs(s1, useServer) - axisTimeMs(s0, useServer);
  const t = span > 0 ? (renderTime - axisTimeMs(s0, useServer)) / span : 0;
  return {
    distM: s0.distM + (s1.distM - s0.distM) * t,
    mode: "interpolate",
    usedServerAxis: useServer,
    renderTime,
    aheadMs: null,
    s0,
    s1,
    t,
  };
}

export function stepPeerMotionEntity(
  entity: PeerMotionEntity,
  _dtSec: number,
  routeLenM: number,
  nowMs: number = Date.now(),
): void {
  const buf = entity.buffer;
  if (buf.length === 0) return;

  const plan = planPeerMotionStep(entity, nowMs);
  if (entity.phase === "live" && !plan.usedServerAxis) {
    entity.serverAxisFallbackCount += 1;
  }
  entity.displayDistM = clampRouteDist(plan.distM, routeLenM);
}
