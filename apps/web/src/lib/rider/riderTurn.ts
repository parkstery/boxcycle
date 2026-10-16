/**
 * 코너에서 라이더 방향·기울기.
 *
 * 목표 방향은 구간 평균 곡선의 끝점 현이다. 여기서는 그 목표를 각속도로 추종한 뒤
 * `atan(v·ω/g)` 로 안쪽 기울기를 만든다. 위치는 호출부가 같은 반경의 구간 평균에 둔다.
 */

/** 위치·방향이 같이 쓰는 곡선 반경(m). 경로 거리 ±이 값의 구간 평균이 화면 위치다. */
export const RIDER_CURVE_HALF_SPAN_M = 4;
/** 경로 거리가 없는 방향(GPS). */
export const RIDER_TURN_HEADING_TAU_S = 0.15;
/** 경로 거리로 이미 매끄러운 방향(본인·페이서·동행). */
export const RIDER_TURN_HEADING_TAU_ROUTE_S = 0.03;
export const RIDER_LEAN_MAX_DEG = 20;
export const RIDER_LEAN_TAU_S = 0.25;

const GRAVITY_MPS2 = 9.81;

export function wrapHeadingDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((deg % 360) + 360) % 360;
}

/** 최단 회전(−180…180). 180° 정반대는 −180. */
export function shortestAngleDeltaDeg(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return ((to - from + 540) % 360) - 180;
}

/** 현재 방향을 목표 쪽으로 τ 지수 추종. 한 프레임에 목표까지 점프하지 않는다. */
export function approachHeadingDeg(cur: number, target: number, dt: number, tau: number): number {
  if (!Number.isFinite(cur)) return wrapHeadingDeg(target);
  if (!(dt > 0) || !(tau > 0)) return wrapHeadingDeg(cur);
  const delta = shortestAngleDeltaDeg(cur, target);
  const alpha = 1 - Math.exp(-dt / tau);
  return wrapHeadingDeg(cur + delta * alpha);
}

/**
 * 자전거 물리 기울기(도). ω 는 시계방향이 양수.
 * 오른쪽으로 돌면 양수. 상한은 `RIDER_LEAN_MAX_DEG`.
 */
export function physicalLeanDeg(speedMps: number, yawRateRadPerS: number): number {
  const v = Number.isFinite(speedMps) ? speedMps : 0;
  const w = Number.isFinite(yawRateRadPerS) ? yawRateRadPerS : 0;
  const raw = (Math.atan((v * w) / GRAVITY_MPS2) * 180) / Math.PI;
  if (!Number.isFinite(raw)) return 0;
  return Math.max(-RIDER_LEAN_MAX_DEG, Math.min(RIDER_LEAN_MAX_DEG, raw));
}

type TurnState = { headingDeg: number; leanDeg: number };

export class RiderTurnSmoother {
  private readonly states = new Map<string, TurnState>();

  /**
   * 처음 보는 id 는 목표 방향·기울기 0.
   * 이후 방향은 `approachHeadingDeg`, ω 는 그 스무딩된 방향의 프레임 변화율,
   * 기울기는 `physicalLeanDeg` 를 τ 로 추종.
   * `headingTauS` 를 생략하면 GPS 용 0.15 s. 경로 방향은 `RIDER_TURN_HEADING_TAU_ROUTE_S`.
   */
  update(
    id: string,
    targetHeadingDeg: number,
    speedMps: number,
    dtSec: number,
    headingTauS: number = RIDER_TURN_HEADING_TAU_S,
  ): { headingDeg: number; leanDeg: number } {
    const target = wrapHeadingDeg(targetHeadingDeg);
    const prev = this.states.get(id);
    if (!prev) {
      const born: TurnState = { headingDeg: target, leanDeg: 0 };
      this.states.set(id, born);
      return { headingDeg: born.headingDeg, leanDeg: born.leanDeg };
    }
    const dt = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0;
    const tau = Number.isFinite(headingTauS) && headingTauS > 0 ? headingTauS : RIDER_TURN_HEADING_TAU_S;
    const headingDeg =
      dt > 0 ? approachHeadingDeg(prev.headingDeg, target, dt, tau) : prev.headingDeg;
    const deltaDeg = shortestAngleDeltaDeg(prev.headingDeg, headingDeg);
    const yawRateRadPerS = dt > 0 ? ((deltaDeg * Math.PI) / 180) / dt : 0;
    const leanTarget = physicalLeanDeg(speedMps, yawRateRadPerS);
    const leanAlpha = dt > 0 ? 1 - Math.exp(-dt / RIDER_LEAN_TAU_S) : 0;
    const leanRaw = prev.leanDeg + (leanTarget - prev.leanDeg) * leanAlpha;
    const next: TurnState = {
      headingDeg: Number.isFinite(headingDeg) ? headingDeg : prev.headingDeg,
      leanDeg: Number.isFinite(leanRaw) ? leanRaw : prev.leanDeg,
    };
    this.states.set(id, next);
    return { headingDeg: next.headingDeg, leanDeg: next.leanDeg };
  }

  prune(liveIds: Iterable<string>): void {
    const live = liveIds instanceof Set ? liveIds : new Set(liveIds);
    for (const id of this.states.keys()) {
      if (!live.has(id)) this.states.delete(id);
    }
  }
}
