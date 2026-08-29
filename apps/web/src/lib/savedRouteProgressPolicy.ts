/**
 * SavedRoute 진행률·완주 상태의 **단조 보존 규칙**(RIDE-CONTINUE-1 단계 A).
 *
 * Firestore transaction·로컬 저장·중복(dedupe) 갱신이 같은 규칙을 쓰도록 순수 함수로 분리한다.
 * 클라이언트가 `max(기존, 신규)` 를 계산해 덮어쓰면 다른 탭·기기의 늦은 낮은 진행률이
 * 높은 진행률을 되돌릴 수 있다 — 판정은 **서버(또는 저장소) 문서의 현재 값** 기준이다.
 */

/** 임의 값 → 0..1(비유한·범위 밖은 clamp, NaN 은 0) */
export function clampProgressRatio(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export type SavedRouteProgressState = {
  /** 저장소의 현재 완주 플래그 */
  completed: 0 | 1;
  /** 저장소의 현재 진행률(0..1) */
  lastProgressRatio: number;
};

export type SavedRouteProgressDecision = {
  /** 저장소에 쓸 필요가 있는가 — false 면 stale write 라 lastRideId 도 덮지 않는다 */
  shouldWrite: boolean;
  /** 반영 후 진행률(0..1) */
  nextProgressRatio: number;
  /** 반영 후 완주 플래그 */
  completed: 0 | 1;
};

/**
 * 미완주 진행률 갱신 판정.
 *
 * - `completed === 1` 문서는 미완주로 되돌리지 않는다(진행률 1 유지, 쓰기 없음).
 * - 요청 진행률이 현재 값보다 낮으면 stale write — 쓰지 않는다(`lastRideId` 도 보존).
 * - 그 외에는 `max(현재, 요청)` 으로 올린다.
 */
export function resolveSavedRouteProgressUpdate(
  state: SavedRouteProgressState,
  requestedProgressRatio: number,
): SavedRouteProgressDecision {
  const requested = clampProgressRatio(requestedProgressRatio);
  if (state.completed === 1) {
    return { shouldWrite: false, nextProgressRatio: 1, completed: 1 };
  }
  const current = clampProgressRatio(state.lastProgressRatio);
  if (requested <= current) {
    return { shouldWrite: false, nextProgressRatio: current, completed: 0 };
  }
  return { shouldWrite: true, nextProgressRatio: requested, completed: 0 };
}

/** 중복 저장(dedupe) 시 **기존 문서에서 반드시 보존해야 하는** 진행·완주 상태 */
export type DedupedSavedRouteState = {
  completed: 0 | 1;
  completedAtIso: string | null;
  expiresAtIso: string | null;
  lastRideId: string | null;
  lastProgressRatio: number;
  createdAtIso: string;
};

/**
 * 같은 경로를 다시 저장(중복 갱신)할 때 반환할 상태.
 *
 * 서버 메타만 갱신하면서 `completed:0` · `lastProgressRatio:0` 을 합성해 돌려주면,
 * 호출부가 state 에 병합하는 순간 새로고침 전까지 완료·진행률이 사라진다(§2.8).
 * 기존 문서의 값이 있으면 그대로, 없을 때만 신규 기본값으로 폴백한다.
 */
export function preserveDedupedSavedRouteState(
  existing: Partial<DedupedSavedRouteState> | null | undefined,
  fallback: DedupedSavedRouteState,
): DedupedSavedRouteState {
  if (!existing) return fallback;
  const completed: 0 | 1 = existing.completed === 1 ? 1 : 0;
  return {
    completed,
    completedAtIso: existing.completedAtIso ?? (completed === 1 ? fallback.completedAtIso : null),
    // 완주 문서는 TTL 이 없다(영구 보존) — null 을 신규 만료로 되살리지 않는다.
    expiresAtIso: completed === 1 ? null : (existing.expiresAtIso ?? fallback.expiresAtIso),
    lastRideId: existing.lastRideId ?? null,
    lastProgressRatio:
      completed === 1 ? 1 : clampProgressRatio(existing.lastProgressRatio ?? 0),
    createdAtIso: existing.createdAtIso ?? fallback.createdAtIso,
  };
}
