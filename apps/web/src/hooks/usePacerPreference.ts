import type { User } from "firebase/auth";
import { useCallback, useSyncExternalStore } from "react";

/**
 * uid 별 페이서 표시. 기본은 켜짐.
 * 인증 전 write 금지 — 인증 전에는 기본 true 로 읽기만. storage 예외도 true.
 */
const KEY_PREFIX = "rtw_pacer_enabled_v1:";

type Entry = {
  enabled: boolean;
  listeners: Set<() => void>;
};

const entries = new Map<string, Entry>();

function storageKey(uid: string): string {
  return `${KEY_PREFIX}${uid}`;
}

function readEnabled(uid: string): boolean {
  try {
    if (typeof localStorage === "undefined") return true;
    const raw = localStorage.getItem(storageKey(uid));
    if (raw === "0") return false;
    if (raw === "1") return true;
    return true;
  } catch {
    return true;
  }
}

function ensureEntry(uid: string): Entry {
  let entry = entries.get(uid);
  if (!entry) {
    entry = { enabled: readEnabled(uid), listeners: new Set() };
    entries.set(uid, entry);
  }
  return entry;
}

function notify(entry: Entry): void {
  for (const listener of entry.listeners) listener();
}

export function getPacerEnabledSnapshot(uid: string | null | undefined): boolean {
  if (!uid) return true;
  return ensureEntry(uid).enabled;
}

export function subscribePacerEnabled(
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
  const key = storageKey(uid);
  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== key) return;
    entry.enabled = readEnabled(uid);
    notify(entry);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    entry.listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function writePacerEnabled(user: User | null, enabled: boolean): boolean {
  if (!user || typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(storageKey(user.uid), enabled ? "1" : "0");
  } catch {
    return false;
  }
  const entry = ensureEntry(user.uid);
  entry.enabled = enabled;
  notify(entry);
  return true;
}

export function usePacerPreference(user: User | null): {
  enabled: boolean;
  setEnabled: (enabled: boolean) => boolean;
} {
  const uid = user?.uid ?? null;
  const enabled = useSyncExternalStore(
    (onStoreChange) => subscribePacerEnabled(uid, onStoreChange),
    () => getPacerEnabledSnapshot(uid),
    () => true,
  );
  const setEnabled = useCallback(
    (next: boolean): boolean => {
      if (!user) return false;
      return writePacerEnabled(user, next);
    },
    [user],
  );
  return { enabled, setEnabled };
}
