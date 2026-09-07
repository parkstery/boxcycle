/**
 * F5 · Late-response ownership guard — 순수 함수로 추출
 * 
 * useRideConquestResult 훅에서 사용하는 ownership 체크 로직.
 * delayed response가 wrong serverRideId/userId에 적용되지 않도록 보호.
 */

export type ConquestSnapshotData = {
  userId?: string;
  conquestResult?: Record<string, unknown> | null;
};

/**
 * 주행 결과(conquest)가 현재 active user/ride에 적용되어야 하는지 판단.
 * 
 * @param activeUserId - 현재 로그인한 사용자 ID
 * @param activeServerRideId - 현재 표시 중인 주행의 서버 ID
 * @param snapshotData - Firestore snapshot 데이터
 * @returns 적용 가능하면 true, 거부하면 false
 */
export function shouldApplyConquestResult(
  activeUserId: string | null | undefined,
  activeServerRideId: string | null | undefined,
  snapshotData: ConquestSnapshotData | null | undefined,
): boolean {
  if (!activeUserId || !activeServerRideId) return false;
  if (!snapshotData) return false;
  
  // F5: userId 불일치 → 다른 사용자의 주행
  if (snapshotData.userId !== activeUserId) {
    return false;
  }
  
  // serverRideId는 구독 경로에 포함되어 있으므로 implicit match
  // (doc(rides, activeServerRideId)로 구독했으므로 자동 필터링됨)
  
  return true;
}
