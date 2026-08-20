/**
 * S4-13 표시 측 예측+흡수. S4-11 추종기와 같다: 목표 = 예측(now), τ_abs 로 잔차 흡수.
 * E 는 후보 식별자일 뿐 발행에 쓰지 않는다. integrator ingest·S4-5 축은 건드리지 않는다.
 */
import {
  RIDE_SPEED_ACCEL_KMH_PER_SEC,
  RIDE_SPEED_DECEL_KMH_PER_SEC,
} from "../rideSpeedRamp";
import { clampRouteDist, isUsableServerAtMs } from "./integrator";
import type { PeerMotionEntity, PeerMotionSnapshot } from "./types";

const ACCEL_MPS2 = RIDE_SPEED_ACCEL_KMH_PER_SEC / 3.6;
const DECEL_MPS2 = RIDE_SPEED_DECEL_KMH_PER_SEC / 3.6;

type AbsorbState = {
  lastKey: string;
  lastDist: number;
  lastSpeed: number;
  lastT: number;
  offset: number;
  catchVel: number;
  displayVel: number;
  seeded: boolean;
};

const states = new Map<string, AbsorbState>();

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

function snapKey(s: PeerMotionSnapshot): string {
  return `${s.serverAtMs}:${s.recvAtMs}:${s.distM}:${s.speedMps}:${s.seq ?? ""}`;
}

function packetTime(s: PeerMotionSnapshot, useServer: boolean): number {
  return useServer ? s.serverAtMs : s.recvAtMs;
}

function nowAxisMs(entity: PeerMotionEntity, nowMs: number, useServer: boolean): number {
  return useServer && Number.isFinite(entity.clockOffsetMs) ? nowMs - entity.clockOffsetMs : nowMs;
}

export function resetPeerDisplayAbsorb(uid?: string): void {
  if (uid) states.delete(uid);
  else states.clear();
}

export function stepPeerDisplayAbsorb(
  entity: PeerMotionEntity,
  dtSec: number,
  routeLenM: number,
  nowMs: number,
  tauAbs: number,
): void {
  const dt = Math.min(0.12, Math.max(1 / 120, dtSec));
  const newest = entity.buffer[entity.buffer.length - 1];
  if (!newest) return;
  const useServer = bufferUsesServerAxis(entity.buffer);
  const nowT = nowAxisMs(entity, nowMs, useServer);
  const pktT = packetTime(newest, useServer);
  const pred = newest.distM + newest.speedMps * ((nowT - pktT) / 1000);

  const key = snapKey(newest);
  let st = states.get(entity.uid);
  if (!st) {
    st = {
      lastKey: key,
      lastDist: newest.distM,
      lastSpeed: newest.speedMps,
      lastT: pktT,
      offset: 0,
      catchVel: 0,
      displayVel: newest.speedMps,
      seeded: false,
    };
    states.set(entity.uid, st);
  }

  if (!st.seeded) {
    st.offset = 0;
    st.catchVel = 0;
    st.displayVel = newest.speedMps;
    st.lastKey = key;
    st.lastDist = newest.distM;
    st.lastSpeed = newest.speedMps;
    st.lastT = pktT;
    st.seeded = true;
    entity.displayDistM = clampRouteDist(pred, routeLenM);
    return;
  }

  if (st.lastKey !== key) {
    const oldPred = st.lastDist + st.lastSpeed * ((nowT - st.lastT) / 1000);
    st.offset += pred - oldPred;
    st.lastKey = key;
    st.lastDist = newest.distM;
    st.lastSpeed = newest.speedMps;
    st.lastT = pktT;
  }

  const desiredCatch = tauAbs > 1e-6 ? st.offset / tauAbs : st.offset / dt;
  const dv = desiredCatch - st.catchVel;
  const maxUp = ACCEL_MPS2 * dt;
  const maxDown = DECEL_MPS2 * dt;
  const applied = dv >= 0 ? Math.min(dv, maxUp) : -Math.min(-dv, maxDown);
  st.catchVel += applied;
  st.offset -= st.catchVel * dt;
  const newDist = pred - st.offset;
  st.displayVel = (newDist - entity.displayDistM) / dt;
  entity.displayDistM = clampRouteDist(newDist, routeLenM);
}
