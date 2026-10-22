/**
 * 만료가 확정된 uid 의 앱 캐시만 지운다. localStorage 전체와 IndexedDB 는 지우지 않는다.
 */
const UID_LOCAL_KEYS = [
  "boxcycle_ride_resume_slot_v1_",
  "boxcycle_calorie_profile_v1_",
] as const;

function uidLocalCacheKeys(uid: string): string[] {
  return UID_LOCAL_KEYS.map((prefix) => `${prefix}${uid}`);
}

export function clearUidLocalCache(uid: string): string[] {
  if (!uid || typeof localStorage === "undefined") return [];
  const removed: string[] = [];
  for (const key of uidLocalCacheKeys(uid)) {
    try {
      if (localStorage.getItem(key) == null) continue;
      localStorage.removeItem(key);
      removed.push(key);
    } catch {
      /* 저장소가 막혀 있어도 다른 키·다른 uid 는 남긴다 */
    }
  }
  return removed;
}
