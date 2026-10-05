import type { User } from "firebase/auth";
import { useCallback, useSyncExternalStore } from "react";
import type { CalorieIntensityId } from "../lib/ride/caloriesEstimate";
import { parseWeightKg } from "../lib/ride/caloriesEstimate";
import {
  emptyCalorieProfile,
  getCalorieProfileSnapshot,
  subscribeCalorieProfile,
  writeCalorieProfile,
} from "../lib/ride/repo/calorieProfileLocal";

/**
 * uid별 체중·강도. useSyncExternalStore — uid 切替 첫 렌더에 이전 체중 없음.
 * setter 는 updater 밖 where localStorage 기록(StrictMode 중복 write 회피).
 * 인증 전 write 금지. storage 실패 시 false → UI는 이전 스냅샷 유지.
 */
export function useCalorieProfile(user: User | null) {
  const uid = user?.uid ?? null;
  const profile = useSyncExternalStore(
    (onStoreChange) => subscribeCalorieProfile(uid, onStoreChange),
    () => getCalorieProfileSnapshot(uid),
    () => emptyCalorieProfile(),
  );

  const setWeightKg = useCallback(
    (raw: unknown): boolean => {
      if (!user) return false;
      const next = {
        ...getCalorieProfileSnapshot(user.uid),
        weightKg: parseWeightKg(raw),
      };
      return writeCalorieProfile(user, next);
    },
    [user],
  );

  const setIntensityId = useCallback(
    (intensityId: CalorieIntensityId | null): boolean => {
      if (!user) return false;
      const next = {
        ...getCalorieProfileSnapshot(user.uid),
        intensityId,
      };
      return writeCalorieProfile(user, next);
    },
    [user],
  );

  return { profile, setWeightKg, setIntensityId };
}
