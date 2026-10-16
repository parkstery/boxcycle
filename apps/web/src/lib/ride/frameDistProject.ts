import { stepRideSpeedKmh } from "./rideSpeedRamp";

/** 한 프레임으로 볼 수 있는 상한. 표시 시계 dt 클램프와 같다. 이보다 크면 시계가 어긋난 것이다. */
const FRAME_PROJECT_MAX_MS = 1_000;

/**
 * 지도 rAF 가 세션 적분보다 먼저 거리를 읽으면, 화면에 찍히는 이동은 이전 간격이고
 * 떨림 지수의 분모는 이번 rAF 간격이다. 프레임 간격이 들쭉날쭉하면 속도 변동계수가 커진다.
 * 적분 값(virtualDistance)은 쓰지 않고, 이번 프레임 시각까지의 거리만 계산해 돌려준다.
 */
export function projectRideDistToFramePerfMs(
  distM: number,
  appliedSpeedKmh: number,
  targetSpeedKmh: number,
  lastIntegratedPerfMs: number | null,
  framePerfMs: number,
): number {
  if (lastIntegratedPerfMs == null || !Number.isFinite(lastIntegratedPerfMs)) return distM;
  if (!Number.isFinite(framePerfMs) || !Number.isFinite(distM)) return distM;
  const aheadMs = framePerfMs - lastIntegratedPerfMs;
  if (!(aheadMs > 0) || aheadMs > FRAME_PROJECT_MAX_MS) return distM;
  const speedKmh = stepRideSpeedKmh(appliedSpeedKmh, targetSpeedKmh, aheadMs);
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return distM;
  return distM + (speedKmh / 3.6) * (aheadMs / 1000);
}
