/**
 * uid 별 localStorage 캐시 항목의 구독 공통부 — 리스너 등록 + 다른 탭 storage event 반영.
 * 같은 탭은 write 쪽이 리스너를 직접 통지한다. `refresh` 는 캐시를 저장소에서 다시 읽고,
 * 그 뒤 `listeners` 전원에게 통지한다.
 */
export function subscribeStorageEntry(
  listeners: Set<() => void>,
  onStoreChange: () => void,
  storageKey: string,
  refresh: () => void,
): () => void {
  listeners.add(onStoreChange);
  if (typeof window === "undefined") {
    return () => {
      listeners.delete(onStoreChange);
    };
  }
  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== storageKey) return;
    refresh();
    for (const listener of listeners) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}
