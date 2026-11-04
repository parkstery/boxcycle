/**
 * 주행별 전송 진단 — 저장되는 `rides.netStats`. 비용 L4b(document/ops/20261103-cost-squeeze).
 *
 * 왜 — 2026-11-04 운영 로그에서 한 주행 안에 12초 줄기와 4초 줄기가 함께 보였는데, 함수 호출 로그에는
 * 어느 기기인지 없고 브라우저 계측도 재현하지 못했다. 그래서 앱이 판단 이유를 직접 세어 주행과 함께 남긴다.
 * 위치 문서가 아니라 주행 저장 때 한 번만 쓰므로 쓰기 비용은 늘지 않는다.
 */
import type { RtdbMotionHealthReason } from "./rideSyncPolicy";

export type RideNetStats = {
  v: 1;
  /** 송신 틱(100ms) 중 판단 이유별 횟수 */
  healthy: number;
  disconnected: number;
  noAck: number;
  staleAck: number;
  /** Firestore 위치 쓰기 횟수 — 그중 RTDB 정상일 때 쓴 수 */
  fsWrites: number;
  fsWritesHealthy: number;
};

const empty = (): RideNetStats => ({
  v: 1,
  healthy: 0,
  disconnected: 0,
  noAck: 0,
  staleAck: 0,
  fsWrites: 0,
  fsWritesHealthy: 0,
});

let stats = empty();

export function noteRideNetTick(reason: RtdbMotionHealthReason, fsWrite: boolean): void {
  stats[reason] += 1;
  if (fsWrite) {
    stats.fsWrites += 1;
    if (reason === "healthy") stats.fsWritesHealthy += 1;
  }
}

/** 주행 저장 때 꺼내 간다. 꺼내면 비운다. 센 것이 없으면 null(필드를 쓰지 않는다). */
export function takeRideNetStats(): RideNetStats | null {
  const out = stats;
  stats = empty();
  return out.healthy + out.disconnected + out.noAck + out.staleAck > 0 ? out : null;
}
