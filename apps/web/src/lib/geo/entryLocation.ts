/**
 * 첫 진입 위치 선택.
 * 권한 조회와 현재 위치 요청은 분리하고, 진행 중 요청은 generation 으로 무효화한다.
 * 좌표는 저장·로그·전송하지 않는다. 위치를 계속 지켜보는 API 는 쓰지 않는다.
 */

export const ENTRY_PERMISSION_QUERY_WATCHDOG_MS = 1500;
export const ENTRY_GEOLOCATION_TIMEOUT_MS = 8000;

export const ENTRY_LOCATION_NOTICE = {
  unsupported: "이 브라우저에서는 위치를 사용할 수 없어 콜로세움에서 시작합니다.",
  failed: "위치를 확인하지 못해 콜로세움에서 시작합니다.",
  denied: "위치 공유가 거절되어 콜로세움에서 시작합니다.",
  invalid: "위치 좌표가 올바르지 않아 콜로세움에서 시작합니다.",
} as const;

export type EntryLocationPhase = "idle" | "checking" | "choice" | "locating" | "ready";

export type EntryLocationPermission = "granted" | "prompt" | "denied" | "unknown";

export type EntryLocationTarget = {
  center: [number, number];
  zoom: number;
};

export type EntryLocationSnapshot = {
  phase: EntryLocationPhase;
  permission: EntryLocationPermission;
  target: EntryLocationTarget | null;
  notice: string | null;
};

export const IDLE_SNAPSHOT: EntryLocationSnapshot = {
  phase: "idle",
  permission: "unknown",
  target: null,
  notice: null,
};

export const CHECKING_SNAPSHOT: EntryLocationSnapshot = {
  phase: "checking",
  permission: "unknown",
  target: null,
  notice: null,
};

type QueryPermission = "granted" | "prompt" | "denied";

type LocatePermission = "granted" | "prompt" | "unknown";

export type EntryLocationReadOptions = {
  timeout: number;
  maximumAge: number;
  enableHighAccuracy: false;
};

export type EntryLocationEnv = {
  hasGeolocation: () => boolean;
  /** 미지원이면 null. 실패는 reject 또는 throw. */
  queryPermission: () => Promise<QueryPermission> | null;
  readPosition: (
    options: EntryLocationReadOptions,
    handlers: {
      onSuccess: (lng: number, lat: number) => void;
      onError: (kind: "denied" | "timeout" | "failed") => void;
    },
  ) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
};

export function isUsableLngLat(lng: number, lat: number): boolean {
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

export function readBrowserEntryLocationEnv(): EntryLocationEnv {
  return {
    hasGeolocation() {
      return typeof globalThis.navigator?.geolocation?.getCurrentPosition === "function";
    },
    queryPermission() {
      const permissions = globalThis.navigator?.permissions;
      if (typeof permissions?.query !== "function") return null;
      return permissions.query({ name: "geolocation" } as PermissionDescriptor).then((status) => {
        const state = status.state;
        if (state === "granted" || state === "prompt" || state === "denied") return state;
        throw new Error("unexpected geolocation permission");
      });
    },
    readPosition(options, handlers) {
      const geolocation = globalThis.navigator?.geolocation;
      if (typeof geolocation?.getCurrentPosition !== "function") {
        throw new Error("geolocation unavailable");
      }
      geolocation.getCurrentPosition(
        (position) => {
          handlers.onSuccess(position.coords.longitude, position.coords.latitude);
        },
        (error) => {
          if (error.code === 1) handlers.onError("denied");
          else if (error.code === 3) handlers.onError("timeout");
          else handlers.onError("failed");
        },
        {
          enableHighAccuracy: false,
          timeout: options.timeout,
          maximumAge: options.maximumAge,
        },
      );
    },
    setTimeout(fn, ms) {
      return globalThis.setTimeout(fn, ms);
    },
    clearTimeout(id) {
      globalThis.clearTimeout(id as ReturnType<typeof setTimeout>);
    },
  };
}

export type EntryLocationSession = {
  getSnapshot: () => EntryLocationSnapshot;
  subscribe: (listener: (snapshot: EntryLocationSnapshot) => void) => () => void;
  setEnabled: (enabled: boolean) => void;
  chooseRome: () => void;
  chooseCurrent: () => void;
};

export function createEntryLocationSession(
  env: EntryLocationEnv,
  fallbackTarget: EntryLocationTarget,
): EntryLocationSession {
  const fallback: EntryLocationTarget = {
    center: [fallbackTarget.center[0], fallbackTarget.center[1]],
    zoom: fallbackTarget.zoom,
  };
  const listeners = new Set<(snapshot: EntryLocationSnapshot) => void>();
  const timers = new Set<unknown>();
  let snapshot: EntryLocationSnapshot = IDLE_SNAPSHOT;
  let active = false;
  let generation = 0;
  let locateGen: number | null = null;

  function emit() {
    for (const listener of listeners) listener(snapshot);
  }

  function isCurrent(gen: number): boolean {
    return active && gen === generation;
  }

  function clearTimers() {
    for (const id of timers) env.clearTimeout(id);
    timers.clear();
  }

  function arm(ms: number, fn: () => void): () => void {
    const id = env.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return () => {
      env.clearTimeout(id);
      timers.delete(id);
    };
  }

  function bump(): number {
    generation += 1;
    locateGen = null;
    clearTimers();
    return generation;
  }

  function retire(gen: number) {
    if (generation === gen) generation += 1;
    locateGen = null;
  }

  function settleReady(gen: number, notice: string, permission: EntryLocationPermission = snapshot.permission) {
    if (!isCurrent(gen)) return;
    clearTimers();
    snapshot = {
      phase: "ready",
      permission,
      target: fallback,
      notice,
    };
    emit();
    retire(gen);
  }

  function settleChoice(gen: number, permission: EntryLocationPermission) {
    if (!isCurrent(gen)) return;
    snapshot = {
      phase: "choice",
      permission,
      target: null,
      notice: null,
    };
    emit();
  }

  function startLocate(gen: number, permission: LocatePermission) {
    if (!isCurrent(gen) || locateGen === gen) return;
    if (!env.hasGeolocation()) {
      settleReady(gen, ENTRY_LOCATION_NOTICE.unsupported);
      return;
    }
    locateGen = gen;
    snapshot = {
      phase: "locating",
      permission,
      target: null,
      notice: null,
    };
    emit();

    let done = false;
    const cancelWatch = arm(ENTRY_GEOLOCATION_TIMEOUT_MS, () => {
      if (done || !isCurrent(gen)) return;
      done = true;
      settleReady(gen, ENTRY_LOCATION_NOTICE.failed);
    });

    try {
      env.readPosition(
        {
          timeout: ENTRY_GEOLOCATION_TIMEOUT_MS,
          maximumAge: 0,
          enableHighAccuracy: false,
        },
        {
          onSuccess(lng, lat) {
            if (done || !isCurrent(gen)) return;
            done = true;
            cancelWatch();
            if (!isUsableLngLat(lng, lat)) {
              settleReady(gen, ENTRY_LOCATION_NOTICE.invalid);
              return;
            }
            const target: EntryLocationTarget = {
              center: [lng, lat],
              zoom: fallback.zoom,
            };
            if (!isCurrent(gen)) return;
            clearTimers();
            snapshot = {
              phase: "ready",
              permission,
              target,
              notice: null,
            };
            emit();
            retire(gen);
          },
          onError(kind) {
            if (done || !isCurrent(gen)) return;
            done = true;
            cancelWatch();
            if (kind === "denied") {
              if (!isCurrent(gen)) return;
              clearTimers();
              snapshot = {
                phase: "ready",
                permission: "denied",
                target: fallback,
                notice: ENTRY_LOCATION_NOTICE.denied,
              };
              emit();
              retire(gen);
              return;
            }
            settleReady(gen, ENTRY_LOCATION_NOTICE.failed);
          },
        },
      );
    } catch {
      if (done || !isCurrent(gen)) return;
      done = true;
      cancelWatch();
      settleReady(gen, ENTRY_LOCATION_NOTICE.unsupported);
    }
  }

  async function runCheck(gen: number): Promise<void> {
    if (!isCurrent(gen)) return;
    if (!env.hasGeolocation()) {
      settleReady(gen, ENTRY_LOCATION_NOTICE.unsupported);
      return;
    }

    let pending: Promise<QueryPermission> | null;
    try {
      pending = env.queryPermission();
    } catch {
      settleChoice(gen, "unknown");
      return;
    }
    if (!pending) {
      settleChoice(gen, "unknown");
      return;
    }

    const cancelWatch = arm(ENTRY_PERMISSION_QUERY_WATCHDOG_MS, () => {
      if (!isCurrent(gen) || snapshot.phase !== "checking") return;
      settleChoice(gen, "unknown");
    });

    try {
      const state = await pending;
      cancelWatch();
      if (!isCurrent(gen) || snapshot.phase !== "checking") return;
      if (state === "granted") startLocate(gen, "granted");
      else if (state === "prompt" || state === "denied") settleChoice(gen, state);
      else settleChoice(gen, "unknown");
    } catch {
      cancelWatch();
      if (!isCurrent(gen) || snapshot.phase !== "checking") return;
      settleChoice(gen, "unknown");
    }
  }

  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEnabled(enabled) {
      if (!enabled) {
        active = false;
        bump();
        snapshot = IDLE_SNAPSHOT;
        emit();
        return;
      }
      active = true;
      const gen = bump();
      snapshot = CHECKING_SNAPSHOT;
      emit();
      void runCheck(gen);
    },
    chooseRome() {
      if (!active) return;
      const permission = snapshot.permission;
      bump();
      snapshot = {
        phase: "ready",
        permission,
        target: fallback,
        notice: null,
      };
      emit();
    },
    chooseCurrent() {
      if (!active) return;
      if (snapshot.phase !== "choice") return;
      if (snapshot.permission !== "prompt" && snapshot.permission !== "unknown") return;
      startLocate(generation, snapshot.permission);
    },
  };
}
