import type { RideEndResult } from "./rideEndResult";

/**
 * RideSummarySheet 에서 `rideSaveStatus` → 표시 문자열.
 *
 * 이 함수로 어서트하면 실제 시트 렌더 결과와 동일하다 — 시트가 이 함수를 사용하므로.
 * N2 테스트(`ride-result-n2-persistence.test.ts`)에서 결과 시트 문구를 증명할 때 쓴다.
 */
export function getRideSaveStatusLabel(
  status: RideEndResult["rideSaveStatus"] | "n/a",
): string | null {
  if (status === "pending") return "주행 저장 중…";
  if (status === "failed") return "⚠ 주행 저장 실패";
  return null; // "success" | "n/a" | undefined → 표시 없음
}

/**
 * RideSummarySheet 에서 `savedRouteProgressStatus` → 표시 문자열.
 */
export function getSavedRouteProgressStatusLabel(
  status: RideEndResult["savedRouteProgressStatus"] | "n/a",
): string | null {
  if (status === "pending") return "진행률 저장 중…";
  if (status === "failed") return "⚠ 진행률 저장 실패";
  return null;
}
