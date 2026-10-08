/**
 * 체중·강도 기기 간 동기화 판정(순수) — 서버(userPrivate/{uid})가 진실, 로컬은 즉시 표시용 캐시.
 * 2026-10-08 Chief: 기기를 바꿔도 다시 입력하지 않게.
 */
import type { CalorieIntensityId } from "./caloriesEstimate";

/** repo/calorieProfileLocal 의 CalorieProfile 과 같은 모양(도메인이 repo 를 import 하지 않게) */
type CalorieProfile = {
  weightKg: number | null;
  intensityId: CalorieIntensityId | null;
};

export type CalorieCloudSnapshot =
  /** 서버 응답이 아직 없다(캐시에서만 읽음) — 「문서 없음」으로 믿지 않는다 */
  | { kind: "pending" }
  | { kind: "missing" }
  | { kind: "present"; profile: CalorieProfile };

export type CalorieSyncAction =
  | { kind: "none" }
  /** 서버 값을 이 기기에 반영 */
  | { kind: "applyLocal"; profile: CalorieProfile }
  /** 서버에 없고 이 기기에만 있다 — 한 번 올린다(기존 사용자 이전) */
  | { kind: "upload"; profile: CalorieProfile };

export function sameCalorieProfile(a: CalorieProfile, b: CalorieProfile): boolean {
  return a.weightKg === b.weightKg && a.intensityId === b.intensityId;
}

export function isEmptyCalorieProfile(p: CalorieProfile): boolean {
  return p.weightKg == null && p.intensityId == null;
}

export function decideCalorieSync(
  cloud: CalorieCloudSnapshot,
  local: CalorieProfile,
): CalorieSyncAction {
  if (cloud.kind === "pending") return { kind: "none" };
  if (cloud.kind === "missing") {
    return isEmptyCalorieProfile(local) ? { kind: "none" } : { kind: "upload", profile: local };
  }
  return sameCalorieProfile(cloud.profile, local)
    ? { kind: "none" }
    : { kind: "applyLocal", profile: cloud.profile };
}
