/**
 * 체중·강도 — uid별 localStorage 캐시. 서버 원본은 userPrivate/{uid}(본인 전용, `calorieProfileCloud`).
 * 인증 전 영속 금지. 같은 탭은 리스너, 다른 탭은 storage event.
 */
import type { User } from "firebase/auth";
import { canPersistAppData } from "../../storage/clientPersistencePolicy";
import {
  parseCalorieIntensityId,
  parseWeightKg,
  type CalorieIntensityId,
} from "../caloriesEstimate";

export type CalorieProfile = {
  weightKg: number | null;
  intensityId: CalorieIntensityId | null;
};

type ProfileEntry = {
  profile: CalorieProfile;
  listeners: Set<() => void>;
};

const EMPTY_PROFILE: CalorieProfile = Object.freeze({
  weightKg: null,
  intensityId: null,
});

const entries = new Map<string, ProfileEntry>();

function profileKey(uid: string): string {
  return `boxcycle_calorie_profile_v1_${uid}`;
}

export function emptyCalorieProfile(): CalorieProfile {
  return EMPTY_PROFILE;
}

export function parseCalorieProfile(raw: unknown): CalorieProfile {
  if (!raw || typeof raw !== "object") return emptyCalorieProfile();
  const o = raw as Record<string, unknown>;
  return {
    weightKg: parseWeightKg(o.weightKg),
    intensityId: parseCalorieIntensityId(o.intensityId),
  };
}

function readCalorieProfileFromStorage(uid: string): CalorieProfile {
  try {
    if (typeof localStorage === "undefined") return emptyCalorieProfile();
    const raw = localStorage.getItem(profileKey(uid));
    if (!raw) return emptyCalorieProfile();
    return parseCalorieProfile(JSON.parse(raw) as unknown);
  } catch {
    return emptyCalorieProfile();
  }
}

function ensureEntry(uid: string): ProfileEntry {
  let entry = entries.get(uid);
  if (!entry) {
    entry = {
      profile: readCalorieProfileFromStorage(uid),
      listeners: new Set(),
    };
    entries.set(uid, entry);
  }
  return entry;
}

function notify(entry: ProfileEntry): void {
  for (const listener of entry.listeners) listener();
}

/** useSyncExternalStore getSnapshot — uid 없으면 빈 프로필(이전 uid 체중 노출 금지). */
export function getCalorieProfileSnapshot(uid: string | null | undefined): CalorieProfile {
  if (!uid) return EMPTY_PROFILE;
  return ensureEntry(uid).profile;
}

/**
 * 같은 탭: write 가 listeners 통지.
 * 다른 탭: storage event 로 캐시 갱신 후 통지.
 */
export function subscribeCalorieProfile(
  uid: string | null | undefined,
  onStoreChange: () => void,
): () => void {
  if (!uid) return () => {};
  const entry = ensureEntry(uid);
  entry.listeners.add(onStoreChange);
  if (typeof window === "undefined") {
    return () => {
      entry.listeners.delete(onStoreChange);
    };
  }
  const key = profileKey(uid);
  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== key) return;
    entry.profile = readCalorieProfileFromStorage(uid);
    notify(entry);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    entry.listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** 시험·리셋용 — 캐시를 저장소에서 다시 읽거나 비운다. */
export function resetCalorieProfileCacheForTests(uid?: string): void {
  if (uid) {
    entries.delete(uid);
    return;
  }
  entries.clear();
}

export function readCalorieProfile(uid: string): CalorieProfile {
  return getCalorieProfileSnapshot(uid);
}

/**
 * 인증된 user 만 영속. 성공 시 캐시·리스너 갱신.
 * 실패(쿼터·private mode·인증 전) 시 false — UI는 이전 스냅샷 유지.
 */
export function writeCalorieProfile(user: User | null, profile: CalorieProfile): boolean {
  if (!canPersistAppData(user) || !user || typeof localStorage === "undefined") return false;
  const next: CalorieProfile = {
    weightKg: parseWeightKg(profile.weightKg),
    intensityId: parseCalorieIntensityId(profile.intensityId),
  };
  try {
    localStorage.setItem(profileKey(user.uid), JSON.stringify(next));
  } catch {
    return false;
  }
  const entry = ensureEntry(user.uid);
  entry.profile = next;
  notify(entry);
  return true;
}
