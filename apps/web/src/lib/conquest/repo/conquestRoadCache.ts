import type { RoadCache } from "../conquestRoadSync";

// Owned app cache. Cleared alongside Firebase auth storage on reset/deletion.
const ROAD_CACHE_DATABASE = "spinatlas-conquest-cache-v1";
const STORE = "snapshots";

async function accessCache(key: string, mode: "read" | "write" | "delete", value?: RoadCache): Promise<unknown> {
  if (typeof indexedDB === "undefined") return null;
  return new Promise(resolve => {
    let database: IDBDatabase | undefined;
    let settled = false;
    const open = indexedDB.open(ROAD_CACHE_DATABASE, 1);
    const finish = (result: unknown = null) => { settled = true; database?.close(); resolve(result); };
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => finish();
    open.onblocked = () => finish();
    open.onsuccess = () => {
      database = open.result;
      if (settled) { database.close(); return; }
      database.onversionchange = () => database?.close();
      try {
        const tx = database.transaction(STORE, mode === "read" ? "readonly" : "readwrite");
        const store = tx.objectStore(STORE);
        const request = mode === "read" ? store.get(key) : mode === "write" ? store.put(value, key) : store.delete(key);
        let result: unknown = null;
        request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => finish(result);
        tx.onabort = () => finish();
        tx.onerror = () => finish();
      } catch { finish(); }
    };
  });
}

/** Persistence failure is a cache miss, never a lost or failed server update. */
export function roadCacheFor(namespace: string, uid: string) {
  const key = JSON.stringify([namespace, uid]);
  return {
    readCache: () => accessCache(key, "read").catch(() => null),
    writeCache: async (value: RoadCache) => { await accessCache(key, "write", value).catch(() => null); },
    dropCache: async () => { await accessCache(key, "delete").catch(() => null); },
  };
}
