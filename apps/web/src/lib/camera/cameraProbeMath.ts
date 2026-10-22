/**
 * DEV 카메라 프로브(`cameraFollowTrace` · `cameraRenderPhase`) 공용 수학.
 */

/** 센티넬(NaN·Infinity·1e12 이상)을 걸러낸다. */
export function finite(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n) < 1e12;
}

/** `from` → `to` 최단 각도 차(도, -180..180). */
export function shortestAngleDelta(from: number, to: number): number {
  let n = (to - from) % 360;
  if (n > 180) n -= 360;
  if (n < -180) n += 360;
  return n;
}
