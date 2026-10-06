/**
 * ad-hoc 주행 결과 「내 경로로 저장」 시 완주→promote / 미완주→progress 판정.
 *
 * 저장 경로를 불러와 달린 경우(`persistRideEndCore` §5)와 **같은 완주·진행률 규칙**을
 * 재사용한다. Firestore 호출·UI 문구는 이 판정 결과에 따른다.
 */

import {
  clampProgressRatio,
  resolveSavedRouteProgressUpdate,
  type SavedRouteProgressState,
} from "./savedRouteProgressPolicy";

export type AdhocSaveProgressIntent = {
  /** 종료 시점 `rideCompletedRoute`(≥98%) — 새 계산 금지 */
  completedRoute: boolean;
  /** 종료 시점 `progressToSave`(0..1) */
  progressRatio: number;
};

export type AdhocSaveServerAction =
  | { action: "promote" }
  | { action: "progress"; progressRatio: number };

/**
 * 서버 호출 분기 — 완주면 promote, 아니면 progress 갱신(transaction 쪽 단조 정책).
 */
export function resolveAdhocSaveServerAction(
  intent: AdhocSaveProgressIntent,
): AdhocSaveServerAction {
  if (intent.completedRoute) {
    return { action: "promote" };
  }
  return {
    action: "progress",
    progressRatio: clampProgressRatio(intent.progressRatio),
  };
}

/**
 * 반영 후 로컬 목록에 쓸 진행·완주 상태.
 * - 완주 intent → completed=1 / progress=1
 * - 미완주 + 기존 문서(dedupe) → {@link resolveSavedRouteProgressUpdate}(낮추지 않음·완주 유지)
 * - 미완주 + 신규 → requested progress
 */
export function resolveAdhocSaveAppliedState(
  existing: SavedRouteProgressState | null | undefined,
  intent: AdhocSaveProgressIntent,
): SavedRouteProgressState {
  if (intent.completedRoute) {
    return { completed: 1, lastProgressRatio: 1 };
  }
  const requested = clampProgressRatio(intent.progressRatio);
  if (!existing) {
    return { completed: 0, lastProgressRatio: requested };
  }
  const decision = resolveSavedRouteProgressUpdate(existing, requested);
  return {
    completed: decision.completed,
    lastProgressRatio: decision.nextProgressRatio,
  };
}
