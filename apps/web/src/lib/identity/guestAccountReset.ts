/**
 * 게스트(익명) 계정 초기화 — 지시07 B.
 * Auth `user.delete()` + 앱 localStorage/IndexedDB 정리 후 reload.
 */
import type { User } from "firebase/auth";
import { LOCAL_FIRST_REGION_STORAGE_KEY } from "../geo/localFirstRegion";

const APP_LOCAL_STORAGE_KEYS = [
  LOCAL_FIRST_REGION_STORAGE_KEY,
  "boxcycle_web_saved_routes_v1",
] as const;

const APP_LOCAL_STORAGE_PREFIXES = ["rtw.", "boxcycle_", "boxcycle"] as const;

export function listAppLocalStorageKeys(): string[] {
  if (typeof localStorage === "undefined") return [];
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if ((APP_LOCAL_STORAGE_KEYS as readonly string[]).includes(k)) {
      out.push(k);
      continue;
    }
    if (APP_LOCAL_STORAGE_PREFIXES.some((p) => k.startsWith(p))) out.push(k);
  }
  return out;
}

export function clearAppLocalStorage(): string[] {
  const keys = listAppLocalStorageKeys();
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  return keys;
}

async function clearFirebaseAuthIndexedDb(): Promise<void> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return;
  try {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs
        .filter((d) => {
          const n = d.name ?? "";
          return /firebase|firebaseLocalStorage|firebase-heartbeat/i.test(n);
        })
        .map(
          (d) =>
            new Promise<void>((resolve) => {
              if (!d.name) {
                resolve();
                return;
              }
              const req = indexedDB.deleteDatabase(d.name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            }),
        ),
    );
  } catch {
    /* ignore */
  }
}

export type GuestResetResult = {
  deletedAuth: boolean;
  deleteError: string | null;
  clearedKeys: string[];
};

/**
 * 익명 계정만. 호출 전 UI 에서 `user.isAnonymous` 를 재확인하라.
 */
export async function resetGuestAccount(user: User): Promise<GuestResetResult> {
  if (!user.isAnonymous) {
    throw new Error("게스트(익명) 계정만 초기화할 수 있습니다.");
  }

  let deletedAuth = false;
  let deleteError: string | null = null;
  try {
    await user.delete();
    deletedAuth = true;
  } catch (e) {
    deleteError = e instanceof Error ? e.message : String(e);
  }

  const clearedKeys = clearAppLocalStorage();
  await clearFirebaseAuthIndexedDb();

  return { deletedAuth, deleteError, clearedKeys };
}
