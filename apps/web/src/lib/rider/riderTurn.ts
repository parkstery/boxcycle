/**
 * 코너에서 라이더 방향·기울기.
 *
 * 경로 방향은 표시 위치 곡선의 접선에 정렬한다. GPS 방향만 시간 보간한다.
 * `atan(v·ω/g) = atan(v²/(g·R))` 로 몸과 자전거 전체의 안쪽 기울기를 만든다.
 */

/** 위치·방향에 공통 적용하는 테이퍼 반폭(m). 실제 회전 반경과는 다르다. */
export const RIDER_CURVE_HALF_SPAN_M = 13.5;
/** 경로 거리가 없는 방향(GPS). */
export const RIDER_TURN_HEADING_TAU_S = 0.15;
/** 이미 공간 보간한 경로 접선은 지연 없이 따른다(옆미끄럼 방지). */
export const RIDER_TURN_HEADING_TAU_ROUTE_S = 0;
const RIDER_LEAN_MAX_DEG = 35;
const RIDER_LEAN_MAX_RATE_DEG_S = 30;
const RIDER_LEAN_MAX_ACCEL_DEG_S2 = 120;
const RIDER_LEAN_FOLLOW_FREQUENCY = 10;

const GRAVITY_MPS2 = 9.81;

function wrapHeadingDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((deg % 360) + 360) % 360;
}

/** 최단 회전(−180…180). 180° 정반대는 −180. */
export function shortestAngleDeltaDeg(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return ((to - from + 540) % 360) - 180;
}

/** 현재 방향을 목표 쪽으로 τ 지수 추종. 한 프레임에 목표까지 점프하지 않는다. */
function approachHeadingDeg(cur: number, target: number, dt: number, tau: number): number {
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
function physicalLeanDeg(speedMps: number, yawRateRadPerS: number): number {
  const v = Number.isFinite(speedMps) ? Math.max(0, speedMps) : 0;
  const w = Number.isFinite(yawRateRadPerS) ? yawRateRadPerS : 0;
  const raw = (Math.atan((v * w) / GRAVITY_MPS2) * 180) / Math.PI;
  if (!Number.isFinite(raw)) return 0;
  return Math.max(-RIDER_LEAN_MAX_DEG, Math.min(RIDER_LEAN_MAX_DEG, raw));
}

type TurnState = { headingDeg: number; leanDeg: number; leanRateDegS: number };

/** 전신 롤의 속도·가속도를 제한한 임계 감쇠 추종. 낮은 FPS도 작은 시간 간격으로 적분한다. */
function followLean(prev: TurnState, target: number, dt: number): { leanDeg: number; leanRateDegS: number } {
  let angle = prev.leanDeg;
  let rate = prev.leanRateDegS;
  const steps = Math.ceil(dt * 120);
  const h = steps > 0 ? dt / steps : 0;
  const w = RIDER_LEAN_FOLLOW_FREQUENCY;
  for (let i = 0; i < steps; i++) {
    const acceleration = Math.max(-RIDER_LEAN_MAX_ACCEL_DEG_S2, Math.min(RIDER_LEAN_MAX_ACCEL_DEG_S2,
      w * w * (target - angle) - 2 * w * rate));
    rate = Math.max(-RIDER_LEAN_MAX_RATE_DEG_S, Math.min(RIDER_LEAN_MAX_RATE_DEG_S, rate + acceleration * h));
    angle += rate * h;
  }
  return { leanDeg: angle, leanRateDegS: rate };
}

export class RiderTurnSmoother {
  private readonly states = new Map<string, TurnState>();

  /**
   * 처음 보는 id 는 목표 방향·기울기 0.
   * 경로 방향은 접선 그대로, GPS 방향은 `approachHeadingDeg` 로 추종한다.
   * ω 는 표시 방향의 변화율. 전신 롤은 최대30도/s·120도/s²로 제한한다.
   * headingTauS=0 은 공간 보간된 경로 전용. 생략하면 GPS 용 0.15s.
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
      const born: TurnState = { headingDeg: target, leanDeg: 0, leanRateDegS: 0 };
      this.states.set(id, born);
      return { headingDeg: born.headingDeg, leanDeg: born.leanDeg };
    }
    const dt = Number.isFinite(dtSec) && dtSec > 0 ? Math.min(0.5, dtSec) : 0;
    const tau = Number.isFinite(headingTauS) && headingTauS >= 0 ? headingTauS : RIDER_TURN_HEADING_TAU_S;
    const headingDeg =
      dt > 0 ? (tau === 0 ? target : approachHeadingDeg(prev.headingDeg, target, dt, tau)) : prev.headingDeg;
    const deltaDeg = shortestAngleDeltaDeg(prev.headingDeg, headingDeg);
    const yawRateRadPerS = dt > 0 ? ((deltaDeg * Math.PI) / 180) / dt : 0;
    const leanTarget = physicalLeanDeg(speedMps, yawRateRadPerS);
    const lean = followLean(prev, leanTarget, dt);
    const next: TurnState = {
      headingDeg: Number.isFinite(headingDeg) ? headingDeg : prev.headingDeg,
      leanDeg: lean.leanDeg,
      leanRateDegS: lean.leanRateDegS,
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
