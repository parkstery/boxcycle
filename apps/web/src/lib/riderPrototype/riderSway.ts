/**
 * rider14 상체 흔들림. 뷰어 `updateSway` 와 같은 식.
 * `wave = cos(a − crankPhaseR − lag)`, lag 기본 −60°.
 * envelope(0–1) 를 셰이더 롤·bob·자전거 롤에 곱한다.
 */

export const RIDER_SWAY_DEFAULTS = {
  shoulderRollDeg: 0.5,
  bikeRollDeg: 0.4,
  bobMm: 2,
  lagDeg: -60,
  counter: false,
  pivot: [-0.20, 1.00, 0],
} as const;

export type RiderSwayParams = typeof RIDER_SWAY_DEFAULTS;

const DEG = Math.PI / 180;
const HOLD_MS = 300;
const TAU_MS = 400;

export function computeRiderSway(
  phaseRev: number,
  crankPhaseR: number,
  envelope: number,
  params: RiderSwayParams = RIDER_SWAY_DEFAULTS,
): { shaderRollRad: number; bobM: number; bikeRollRad: number } {
  if (envelope === 0) return { shaderRollRad: 0, bobM: 0, bikeRollRad: 0 };
  const sign = params.counter ? -1 : 1;
  const a = phaseRev * Math.PI * 2;
  const lag = params.lagDeg * DEG;
  const wave = Math.cos(a - crankPhaseR - lag);
  const shoulder = params.shoulderRollDeg * DEG;
  const bike = params.bikeRollDeg * DEG;
  const bob = params.bobMm / 1000;
  const bikeRollRad = -sign * bike * wave * envelope;
  const bodyRollRad = sign * shoulder * wave * envelope;
  return {
    shaderRollRad: bodyRollRad - bikeRollRad,
    bobM: -bob * (0.5 + 0.5 * Math.cos(2 * (a - crankPhaseR))) * envelope,
    bikeRollRad,
  };
}

type SwayEnvelopeState = {
  phaseRev: number;
  lastChangeMs: number;
  lastMs: number;
  value: number;
};

function approach(value: number, target: number, dtMs: number): number {
  if (dtMs <= 0) return value;
  const alpha = 1 - Math.exp(-dtMs / TAU_MS);
  return value + (target - value) * alpha;
}

/** 라이더 id 별 흔들림 크기. 최근 300 ms 에 위상이 바뀌면 목표 1, 아니면 0. τ 400 ms. */
export class RiderSwayEnvelope {
  private readonly states = new Map<string, SwayEnvelopeState>();

  update(id: string, phaseRev: number, nowMs: number, enabled: boolean): number {
    const state = this.states.get(id);
    if (!state) {
      this.states.set(id, {
        phaseRev,
        lastChangeMs: Number.NEGATIVE_INFINITY,
        lastMs: nowMs,
        value: 0,
      });
      return 0;
    }
    if (phaseRev !== state.phaseRev) {
      state.phaseRev = phaseRev;
      state.lastChangeMs = nowMs;
    }
    const dt = nowMs - state.lastMs;
    if (dt > 0) {
      if (!enabled) {
        state.value = approach(state.value, 0, dt);
      } else {
        const holdEnd = state.lastChangeMs + HOLD_MS;
        let cursor = state.lastMs;
        if (cursor < holdEnd) {
          const holdDt = Math.min(nowMs, holdEnd) - cursor;
          state.value = approach(state.value, 1, holdDt);
          cursor += holdDt;
        }
        if (cursor < nowMs) state.value = approach(state.value, 0, nowMs - cursor);
      }
    }
    state.lastMs = nowMs;
    return state.value;
  }

  prune(liveIds: ReadonlySet<string>): void {
    for (const id of this.states.keys()) {
      if (!liveIds.has(id)) this.states.delete(id);
    }
  }
}
