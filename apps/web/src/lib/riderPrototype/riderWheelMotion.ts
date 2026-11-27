/** 바퀴 위상은 페달·센서·페달 위상 정규화와 독립적으로 적분한다. */
export class RiderWheelMotion {
  private readonly states = new Map<string, { rev: number; timeMs: number }>();

  private readonly circumferenceM: number;

  constructor(circumferenceM: number) { this.circumferenceM = circumferenceM; }

  update(id: string, speedMps: number, timeMs: number): number {
    const state = this.states.get(id) ?? { rev: 0, timeMs };
    const elapsed = (timeMs - state.timeMs) / 1000;
    // 탭 복귀 시 숨겨져 있던 시간을 한꺼번에 재생하지 않는다.
    const dt = elapsed > 0 && elapsed <= 1 ? elapsed : 0;
    const speed = Number.isFinite(speedMps) ? Math.max(0, speedMps) : 0;
    state.rev = (state.rev + speed * dt / this.circumferenceM) % 1;
    state.timeMs = timeMs;
    this.states.set(id, state);
    return state.rev;
  }

  get(id: string): number { return this.states.get(id)?.rev ?? 0; }

  prune(ids: ReadonlySet<string>): void {
    for (const id of this.states.keys()) if (!ids.has(id)) this.states.delete(id);
  }
}
