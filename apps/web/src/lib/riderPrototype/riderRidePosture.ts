/**
 * rider15 주행 자세 전환. 자세별 클립(`Ride_Hoods`·`Ride_Aero`·`Ride_Sprint`)을 섞는다.
 *
 * 자전거 틸팅은 모델 클립에 들어 있다.
 * - Sprint: 엉덩이를 안장에서 든 자세. 체중이 실린(아래로 미는) 발의 반대쪽으로 최대 15° 기운다.
 * - Hoods·Aero: 안장에 앉은 자세. 틸팅은 8° 이내다.
 * 언제 Sprint 로 바꿀지(파워·케이던스 등)는 이 모듈 밖에서 정한다.
 */
export const RIDER_RIDE_POSTURES = ["Ride_Hoods", "Ride_Aero", "Ride_Sprint"] as const;
export type RiderRidePosture = (typeof RIDER_RIDE_POSTURES)[number];
const RIDER_RIDE_POSTURE_DEFAULT: RiderRidePosture = "Ride_Hoods";
/** 자세 전환에 걸리는 시간(ms). */
export const RIDER_RIDE_POSTURE_BLEND_MS = 600;

/** `from` 에서 `to` 로 `amount`(0~1)만큼 넘어간 상태. `from === to` 면 그 자세 하나. */
export type RiderRidePostureBlend = {
  readonly from: RiderRidePosture;
  readonly to: RiderRidePosture;
  readonly amount: number;
};

export function isRiderRidePosture(value: unknown): value is RiderRidePosture {
  return typeof value === "string" && (RIDER_RIDE_POSTURES as readonly string[]).includes(value);
}

function smoothstep(x: number): number {
  const t = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

type PostureState = { from: RiderRidePosture; to: RiderRidePosture; startMs: number };

/**
 * 라이더 id 별 자세 전환. 처음 보는 id 는 바로 목표 자세다.
 * 목표가 바뀌면 지금 더 많이 보이는 자세에서 새 자세로 600 ms 동안 부드럽게 넘어간다.
 */
export class RiderRidePostureFollow {
  private readonly states = new Map<string, PostureState>();

  update(id: string, target: RiderRidePosture | undefined, nowMs: number): RiderRidePostureBlend {
    const goal = isRiderRidePosture(target) ? target : RIDER_RIDE_POSTURE_DEFAULT;
    const state = this.states.get(id);
    if (!state) {
      this.states.set(id, { from: goal, to: goal, startMs: Number.NEGATIVE_INFINITY });
      return { from: goal, to: goal, amount: 1 };
    }
    if (goal !== state.to) {
      const shown = this.amountOf(state, nowMs) >= 0.5 ? state.to : state.from;
      state.from = shown;
      state.to = goal;
      state.startMs = nowMs;
    }
    const amount = this.amountOf(state, nowMs);
    if (amount >= 1) state.from = state.to;
    return { from: state.from, to: state.to, amount: state.from === state.to ? 1 : amount };
  }

  prune(liveIds: ReadonlySet<string>): void {
    for (const id of this.states.keys()) {
      if (!liveIds.has(id)) this.states.delete(id);
    }
  }

  private amountOf(state: PostureState, nowMs: number): number {
    if (state.from === state.to) return 1;
    return smoothstep((nowMs - state.startMs) / RIDER_RIDE_POSTURE_BLEND_MS);
  }
}
