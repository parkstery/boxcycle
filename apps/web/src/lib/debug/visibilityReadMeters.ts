/**
 * TASK-02 DEV/test operation proxy — visibility 복귀 시 경로별 open/close·one-shot·presence write.
 * billed Firestore read 가 아니다. Emulator/SDK 내부 reconnect 비용은 여기 없다.
 *
 * production(`import.meta.env.DEV` false) 에서는 note/track 이 no-op 이거나 unsub 를 그대로 반환한다.
 * 실제 Firebase 호출을 두 번 만들지 않는다 — 기존 unsub 를 감싸기만 한다.
 */

export type VisibilityListenerPath =
  | "openTrailListings"
  | "collectionGroupLiveRides"
  | "trailMembers"
  | "trailLiveRides"
  | "users"
  | "economy"
  | "conquest";

export type VisibilityOneShotPath =
  | "activityWorldSummary"
  | "activityWorldGlobal"
  | "activityWorldLiveIds"
  /** `fetchRouteActivitiesBatch` 진입 — cache hit 포함 invocation (network 아님) */
  | "activityWorldBatchInvocation"
  /** `fetchRouteActivity` cache/inflight miss 후 실제 `getDoc` 직전 */
  | "activityWorldRouteActivityGetDoc"
  | "catalogPublications"
  | "catalogLabels"
  | "routeGeometryGapFill";

export type VisibilityListenerMeter = {
  open: number;
  openTotal: number;
  closeTotal: number;
};

export type VisibilityListenerClass =
  | "app_resubscribe_on_visible"
  | "kept_across_visibility"
  | "sdk_unmetered";

export type VisibilityReadMetersSnapshot = {
  source: "visibilityReadMeters";
  totalsAreCumulative: true;
  compareDeltasUsing: "openTotal_closeTotal_oneShot_presence";
  atMs: number;
  listeners: Record<VisibilityListenerPath, VisibilityListenerMeter>;
  oneShots: Record<VisibilityOneShotPath, number>;
  /** Trail presence upsert/touch — read 와 합치지 말 것 */
  trailPresenceWrites: number;
  classification: Record<VisibilityListenerPath, VisibilityListenerClass>;
};

const LISTENER_PATHS: readonly VisibilityListenerPath[] = [
  "openTrailListings",
  "collectionGroupLiveRides",
  "trailMembers",
  "trailLiveRides",
  "users",
  "economy",
  "conquest",
] as const;

const ONE_SHOT_PATHS: readonly VisibilityOneShotPath[] = [
  "activityWorldSummary",
  "activityWorldGlobal",
  "activityWorldLiveIds",
  "activityWorldBatchInvocation",
  "activityWorldRouteActivityGetDoc",
  "catalogPublications",
  "catalogLabels",
  "routeGeometryGapFill",
] as const;

/** 코드상 pageVisible 게이트 유무 — 계측 분류 힌트(런타임 판정이 아님) */
const LISTENER_CLASS: Record<VisibilityListenerPath, VisibilityListenerClass> = {
  openTrailListings: "kept_across_visibility",
  collectionGroupLiveRides: "kept_across_visibility",
  trailMembers: "app_resubscribe_on_visible",
  trailLiveRides: "app_resubscribe_on_visible",
  users: "kept_across_visibility",
  economy: "kept_across_visibility",
  conquest: "kept_across_visibility",
};

function emptyListener(): VisibilityListenerMeter {
  return { open: 0, openTotal: 0, closeTotal: 0 };
}

function emptyListeners(): Record<VisibilityListenerPath, VisibilityListenerMeter> {
  return {
    openTrailListings: emptyListener(),
    collectionGroupLiveRides: emptyListener(),
    trailMembers: emptyListener(),
    trailLiveRides: emptyListener(),
    users: emptyListener(),
    economy: emptyListener(),
    conquest: emptyListener(),
  };
}

function emptyOneShots(): Record<VisibilityOneShotPath, number> {
  return {
    activityWorldSummary: 0,
    activityWorldGlobal: 0,
    activityWorldLiveIds: 0,
    activityWorldBatchInvocation: 0,
    activityWorldRouteActivityGetDoc: 0,
    catalogPublications: 0,
    catalogLabels: 0,
    routeGeometryGapFill: 0,
  };
}

const meters = {
  listeners: emptyListeners(),
  oneShots: emptyOneShots(),
  trailPresenceWrites: 0,
};

function isDevMeter(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/** `unsub` 는 실제 Firebase unsubscribe. production 에서는 그대로 반환. */
export function trackVisibilityListener(
  path: VisibilityListenerPath,
  unsub: () => void,
): () => void {
  if (!isDevMeter()) return unsub;
  const m = meters.listeners[path];
  m.open += 1;
  m.openTotal += 1;
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    unsub();
    m.open = Math.max(0, m.open - 1);
    m.closeTotal += 1;
  };
}

export function noteVisibilityOneShot(path: VisibilityOneShotPath, count = 1): void {
  if (!isDevMeter()) return;
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n <= 0) return;
  meters.oneShots[path] += n;
}

export function noteTrailPresenceWriteProxy(): void {
  if (!isDevMeter()) return;
  meters.trailPresenceWrites += 1;
}

/** DEV·단위시험용. 제품 수명주기에서 호출하지 마라. */
export function resetVisibilityReadMeters(): void {
  meters.listeners = emptyListeners();
  meters.oneShots = emptyOneShots();
  meters.trailPresenceWrites = 0;
}

export function snapshotVisibilityReadMeters(): VisibilityReadMetersSnapshot {
  const listeners = emptyListeners();
  for (const path of LISTENER_PATHS) {
    listeners[path] = { ...meters.listeners[path] };
  }
  const oneShots = emptyOneShots();
  for (const path of ONE_SHOT_PATHS) {
    oneShots[path] = meters.oneShots[path];
  }
  return {
    source: "visibilityReadMeters",
    totalsAreCumulative: true,
    compareDeltasUsing: "openTotal_closeTotal_oneShot_presence",
    atMs: Date.now(),
    listeners,
    oneShots,
    trailPresenceWrites: meters.trailPresenceWrites,
    classification: { ...LISTENER_CLASS },
  };
}

export function deltaVisibilityReadMeters(
  before: VisibilityReadMetersSnapshot,
  after: VisibilityReadMetersSnapshot,
): {
  source: "visibilityReadMetersDelta";
  listeners: Record<VisibilityListenerPath, { openTotal: number; closeTotal: number; open: number }>;
  oneShots: Record<VisibilityOneShotPath, number>;
  trailPresenceWrites: number;
} {
  const listeners = emptyListeners() as Record<
    VisibilityListenerPath,
    { openTotal: number; closeTotal: number; open: number }
  >;
  for (const path of LISTENER_PATHS) {
    listeners[path] = {
      openTotal: after.listeners[path].openTotal - before.listeners[path].openTotal,
      closeTotal: after.listeners[path].closeTotal - before.listeners[path].closeTotal,
      open: after.listeners[path].open - before.listeners[path].open,
    };
  }
  const oneShots = emptyOneShots();
  for (const path of ONE_SHOT_PATHS) {
    oneShots[path] = after.oneShots[path] - before.oneShots[path];
  }
  return {
    source: "visibilityReadMetersDelta",
    listeners,
    oneShots,
    trailPresenceWrites: after.trailPresenceWrites - before.trailPresenceWrites,
  };
}

export const VISIBILITY_LISTENER_PATHS = LISTENER_PATHS;
export const VISIBILITY_ONE_SHOT_PATHS = ONE_SHOT_PATHS;
