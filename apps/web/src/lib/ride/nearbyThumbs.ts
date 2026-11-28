/**
 * 근처 동행 엄지척 후보 판정 (Chief 2026-11-28 결정: 추월 판정 대신 근접 진입).
 *
 * - 엄지척은 **추월당하는 쪽**이 보낸다(11-28 Chief): 나보다 빠른 동행에게만 제안한다.
 *   빠른지는 표시 위치가 아니라 서로 보내는 속도 값으로 본다(0.2 m/s ≈ 0.7 km/h 이상 차이).
 *   아직 빠르지 않으면 이번 진입을 소진하지 않고, 범위 안에서 빨라지는 순간 제안한다.
 * - 제안은 빠른 동행이 **내 옆(3m 뒤)~앞**에 왔을 때만 한다. 뒤에서 다가오는 중에는 화면에
 *   상대가 보이지 않아 누구에게 보내는지 모르고, 상대의 응답 동작도 화면 밖에서 끝난다(11-28 실측).
 * - 같은 방향 동행이 경로 거리 10m 안으로 **새로 들어와** 0.5초 머물면 후보로 보인다.
 *   가까이 있는 동안 계속 보이고(최대 30초), 12m 밖에 2초 계속 있으면 바로 숨긴다(11-28 Chief:
 *   천천히 추월하면 10m→나란히가 18초 걸려 8초 표시는 추월 순간에 이미 사라졌다).
 * - 계속 붙어 있으면 다시 띄우지 않는다. 12m 밖에 10초 이상 머물러 멀어졌다가 다시 들어와야 하고,
 *   같은 동행은 마지막 제안 뒤 30초가 지나야 다시 띄운다(그 전의 재진입은 버린다).
 * - 여러 명이 같은 순간 들어오면 가장 가까운 한 명만 제안하고 나머지 진입은 소진한다.
 *   낡은 수신·반대 방향은 범위 밖으로 본다.
 * - 10초 유지 조건: FS 4/12초 성김에서 동행 표시가 ±10m 톱니로 늦었다 따라잡는다.
 *   잠깐 12m 를 넘는 것은 멀어진 것으로 세지 않는다.
 */
/** relativeSpeedMps = 동행 속도 − 내 속도(양수면 동행이 빠름). */
export type NearbyThumbSample = { id: string; label: string; gapM: number; relativeSpeedMps: number; headingDeltaDeg: number; fresh: boolean };
export type ThumbCandidate = { id: string; label: string; expiresAtMs: number };

const NEARBY_THUMB_ENTER_M = 10;
const NEARBY_THUMB_EXIT_M = 12;
const NEARBY_THUMB_DWELL_MS = 500;
const NEARBY_THUMB_LEAVE_MS = 10000;
const NEARBY_THUMB_SHOW_MS = 30000;
const NEARBY_THUMB_HIDE_OUTSIDE_MS = 2000;
const NEARBY_THUMB_COOLDOWN_MS = 30000;
const ALIGNED_DEG = 45;
const FASTER_MPS = 0.2;
const OFFER_MIN_GAP_M = -3;

type State = { inside: boolean; enteredAtMs: number | null; outsideSinceMs: number | null; consumed: boolean; lastOfferMs: number };

export class NearbyThumbDetector {
  private readonly states = new Map<string, State>();

  update(samples: readonly NearbyThumbSample[], nowMs: number): ThumbCandidate | null {
    const ids = new Set(samples.map((sample) => sample.id));
    // 목록에서 빠진 동행은 범위 밖 관측으로 다룬다. 쿨다운 기록은 남겨 재노출을 막는다.
    for (const [id, state] of this.states) if (!ids.has(id)) this.observeOutside(state, nowMs);
    let best: (ThumbCandidate & { distanceM: number }) | null = null;
    for (const sample of samples) {
      const state = this.states.get(sample.id) ?? { inside: false, enteredAtMs: null, outsideSinceMs: null, consumed: false, lastOfferMs: -Infinity };
      const valid = sample.fresh && Number.isFinite(sample.gapM) && Number.isFinite(sample.headingDeltaDeg)
        && Math.abs(sample.headingDeltaDeg) < ALIGNED_DEG;
      const distanceM = valid ? Math.abs(sample.gapM) : Infinity;
      // 경계 흔들림으로 들락날락하지 않도록 들어올 때 10m, 나갈 때 12m 밖 10초.
      if (distanceM <= NEARBY_THUMB_EXIT_M) state.outsideSinceMs = null;
      if (!state.inside && distanceM <= NEARBY_THUMB_ENTER_M) {
        state.inside = true; state.enteredAtMs = nowMs; state.consumed = false;
      } else if (distanceM > NEARBY_THUMB_EXIT_M) {
        this.observeOutside(state, nowMs);
      }
      const faster = Number.isFinite(sample.relativeSpeedMps) && sample.relativeSpeedMps >= FASTER_MPS;
      const visible = sample.gapM >= OFFER_MIN_GAP_M;
      if (faster && visible && state.inside && !state.consumed && state.enteredAtMs != null && nowMs - state.enteredAtMs >= NEARBY_THUMB_DWELL_MS) {
        // 이번 진입은 한 번만 판정한다. 쿨다운 중이면 제안 없이 소진한다.
        state.consumed = true;
        if (nowMs - state.lastOfferMs >= NEARBY_THUMB_COOLDOWN_MS) {
          const candidate = { id: sample.id, label: sample.label.slice(0, 40), expiresAtMs: nowMs + NEARBY_THUMB_SHOW_MS, distanceM };
          if (!best || distanceM < best.distanceM || (distanceM === best.distanceM && sample.id < best.id)) best = candidate;
        }
      }
      this.states.set(sample.id, state);
    }
    if (!best) return null;
    this.states.get(best.id)!.lastOfferMs = nowMs;
    return { id: best.id, label: best.label, expiresAtMs: best.expiresAtMs };
  }

  /** 표시 중인 후보를 계속 보여도 되는가 — 12m 밖에 2초 계속 있거나 목록에서 빠지면 false. */
  isStillNear(id: string, nowMs: number): boolean {
    const state = this.states.get(id);
    return Boolean(state?.inside && (state.outsideSinceMs == null || nowMs - state.outsideSinceMs < NEARBY_THUMB_HIDE_OUTSIDE_MS));
  }

  private observeOutside(state: State, nowMs: number): void {
    state.outsideSinceMs ??= nowMs;
    if (!state.inside) { state.enteredAtMs = null; return; }
    // 머물기 전 스쳐 나간 진입은 바로 취소, 머문 뒤에는 10초 계속 밖이어야 떠난 것으로 본다.
    if (!state.consumed || nowMs - state.outsideSinceMs >= NEARBY_THUMB_LEAVE_MS) {
      state.inside = false; state.enteredAtMs = null; state.consumed = false;
    }
  }
}
