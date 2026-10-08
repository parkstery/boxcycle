import type { User } from "firebase/auth";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { isFirebaseConfigured } from "../lib/firebase/app";
import type { CalorieIntensityId } from "../lib/ride/caloriesEstimate";
import { parseWeightKg } from "../lib/ride/caloriesEstimate";
import { decideCalorieSync } from "../lib/ride/calorieProfileSync";
import {
  subscribeCalorieProfileCloud,
  writeCalorieProfileCloud,
} from "../lib/ride/repo/calorieProfileCloud";
import {
  emptyCalorieProfile,
  getCalorieProfileSnapshot,
  subscribeCalorieProfile,
  writeCalorieProfile,
  type CalorieProfile,
} from "../lib/ride/repo/calorieProfileLocal";

function pushCloud(uid: string, profile: CalorieProfile): void {
  if (!isFirebaseConfigured()) return;
  void writeCalorieProfileCloud(uid, profile).catch((e: unknown) => {
    // 오프라인이면 Firestore 가 대기열에 두었다가 보낸다. 규칙 거절 등만 여기로 온다.
    if (import.meta.env.DEV) console.warn("[calorieProfile] cloud write failed", e);
  });
}

/**
 * uid별 체중·강도. 서버(userPrivate/{uid})와 동기화 — 기기를 바꿔도 다시 묻지 않는다(2026-10-08).
 * 로컬은 즉시 표시용 캐시, 서버 값이 있으면 서버가 이긴다. useSyncExternalStore — uid 切替 첫 렌더에 이전 체중 없음.
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

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return;
    return subscribeCalorieProfileCloud(
      user.uid,
      (cloud) => {
        const action = decideCalorieSync(cloud, getCalorieProfileSnapshot(user.uid));
        if (action.kind === "applyLocal") writeCalorieProfile(user, action.profile);
        else if (action.kind === "upload") pushCloud(user.uid, action.profile);
      },
      (err) => {
        if (import.meta.env.DEV) console.warn("[calorieProfile] cloud subscribe failed", err);
      },
    );
  }, [user]);

  const setWeightKg = useCallback(
    (raw: unknown): boolean => {
      if (!user) return false;
      const next = {
        ...getCalorieProfileSnapshot(user.uid),
        weightKg: parseWeightKg(raw),
      };
      const ok = writeCalorieProfile(user, next);
      if (ok) pushCloud(user.uid, next);
      return ok;
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
      const ok = writeCalorieProfile(user, next);
      if (ok) pushCloud(user.uid, next);
      return ok;
    },
    [user],
  );

  return { profile, setWeightKg, setIntensityId };
}
