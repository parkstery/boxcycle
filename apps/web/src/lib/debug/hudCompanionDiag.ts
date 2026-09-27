/**
 * H-1 HUD 동행 진단 — 모듈 실제 상태에서 ①~⑥ 을 모은다.
 * window 노출은 installHudCompanionDebug (DEV 전용).
 *
 * ⑥ 의 getDocCount / lastGetDocAtMs 는 실제 Firestore getDoc 만 센다.
 * 캐시 히트·in-flight 합류·setState 는 여기에 넣지 않는다.
 */

export type HudCompanionPeer = { id: string; label: string };
export type HudCompanionLiveRideRow = { uid: string; publicationId: string };

export type HudCompanionRouteActivityDiag = {
  publicationId: string | null;
  activeRiderCount: number | null;
  liveNow: boolean | null;
  firstFetchAtMs: number | null;
  lastGetDocAtMs: number | null;
  lastCacheHitAtMs: number | null;
  getDocCount: number;
  cacheHitCount: number;
  inflightJoinCount: number;
};

export type HudCompanionDiag = {
  atMs: number;
  source: "snapshotHudCompanionDiag";
  /** ① coursePeerHud — live-ride 행에서 만든 HUD peer (dedup 전) */
  coursePeerHud: HudCompanionPeer[];
  /** ② 접속(Trail) 활성 멤버 uid */
  activeTrailMemberUids: string[];
  /** ③ Trail 멤버 dedup 후 동행 이름 수 */
  coursePeerNamesLength: number;
  /** ④ 내 publicationId */
  publicationId: string | null;
  /** ④ 구독 중인 live-ride 행 */
  liveRideRows: HudCompanionLiveRideRow[];
  /** ⑤ motion 원본 행 수 */
  motionRowsLength: number;
  /** ⑤ publicationId 필터 + 자기 제외 후 peers */
  motionPeersAfterPidFilter: number;
  /** ⑥ routeActivity — 캐시 히트와 실제 getDoc 분리 */
  routeActivity: HudCompanionRouteActivityDiag;
};

const emptyRouteActivity = (): HudCompanionRouteActivityDiag => ({
  publicationId: null,
  activeRiderCount: null,
  liveNow: null,
  firstFetchAtMs: null,
  lastGetDocAtMs: null,
  lastCacheHitAtMs: null,
  getDocCount: 0,
  cacheHitCount: 0,
  inflightJoinCount: 0,
});

type Store = {
  coursePeerHud: HudCompanionPeer[];
  activeTrailMemberUids: string[];
  coursePeerNamesLength: number;
  publicationId: string | null;
  liveRideRows: HudCompanionLiveRideRow[];
  motionRowsLength: number;
  motionPeersAfterPidFilter: number;
  /** publicationId → 그 문서의 getDoc/캐시 계측. 스냅샷은 HUD 경로만 고른다. */
  routeActivityById: Map<string, HudCompanionRouteActivityDiag>;
};

function createStore(): Store {
  return {
    coursePeerHud: [],
    activeTrailMemberUids: [],
    coursePeerNamesLength: 0,
    publicationId: null,
    liveRideRows: [],
    motionRowsLength: 0,
    motionPeersAfterPidFilter: 0,
    routeActivityById: new Map(),
  };
}

let store: Store = createStore();

/** production 호스팅에는 없음. Vite DEV 또는 로컬 e2e(127.0.0.1) 에서만. */
function isDev(): boolean {
  if (import.meta.env.DEV === true) return true;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "127.0.0.1" || host === "localhost") return true;
  }
  return false;
}

function ensureWindowHook(): void {
  if (!isDev() || typeof window === "undefined") return;
  (
    window as Window & {
      __rtwHudDiag?: typeof snapshotHudCompanionDiag;
    }
  ).__rtwHudDiag = snapshotHudCompanionDiag;
}

export function resetHudCompanionDiag(): void {
  store = createStore();
}

export function reportHudCompanionHudSlice(input: {
  coursePeerHud: HudCompanionPeer[];
  activeTrailMemberUids: string[];
  coursePeerNamesLength: number;
  publicationId: string | null;
}): void {
  if (!isDev()) return;
  ensureWindowHook();
  store.coursePeerHud = input.coursePeerHud.map((p) => ({ id: p.id, label: p.label }));
  store.activeTrailMemberUids = [...input.activeTrailMemberUids];
  store.coursePeerNamesLength = input.coursePeerNamesLength;
  if (input.publicationId != null) store.publicationId = input.publicationId;
}

export function reportHudCompanionCoursePeers(peers: HudCompanionPeer[]): void {
  if (!isDev()) return;
  ensureWindowHook();
  store.coursePeerHud = peers.map((p) => ({ id: p.id, label: p.label }));
}

export function reportHudCompanionTrailDedup(input: {
  activeTrailMemberUids: string[];
  coursePeerNamesLength: number;
}): void {
  if (!isDev()) return;
  ensureWindowHook();
  store.activeTrailMemberUids = [...input.activeTrailMemberUids];
  store.coursePeerNamesLength = input.coursePeerNamesLength;
}

export function reportHudCompanionPresenceSlice(input: {
  publicationId: string;
  liveRideRows: HudCompanionLiveRideRow[];
  motionRowsLength: number;
  motionPeersAfterPidFilter: number;
}): void {
  if (!isDev()) return;
  ensureWindowHook();
  store.publicationId = input.publicationId;
  store.liveRideRows = input.liveRideRows.map((r) => ({
    uid: r.uid,
    publicationId: r.publicationId,
  }));
  store.motionRowsLength = input.motionRowsLength;
  store.motionPeersAfterPidFilter = input.motionPeersAfterPidFilter;
}

export function recordRouteActivityAccess(input: {
  kind: "cache" | "getDoc" | "inflight";
  publicationId: string;
  activeRiderCount?: number | null;
  liveNow?: boolean | null;
  atMs?: number;
}): void {
  if (!isDev()) return;
  ensureWindowHook();
  const id = input.publicationId.trim();
  if (!id) return;
  const at = input.atMs ?? Date.now();
  let ra = store.routeActivityById.get(id);
  if (!ra) {
    ra = emptyRouteActivity();
    store.routeActivityById.set(id, ra);
  }
  ra.publicationId = id;
  if (ra.firstFetchAtMs == null) ra.firstFetchAtMs = at;
  if (input.kind === "getDoc") {
    ra.getDocCount += 1;
    ra.lastGetDocAtMs = at;
  } else if (input.kind === "cache") {
    ra.cacheHitCount += 1;
    ra.lastCacheHitAtMs = at;
  } else {
    ra.inflightJoinCount += 1;
  }
  if (input.activeRiderCount !== undefined) ra.activeRiderCount = input.activeRiderCount;
  if (input.liveNow !== undefined) ra.liveNow = input.liveNow;
}

function routeActivityForHud(): HudCompanionRouteActivityDiag {
  const pid = store.publicationId?.trim() ?? "";
  if (pid && store.routeActivityById.has(pid)) {
    return { ...store.routeActivityById.get(pid)! };
  }
  return emptyRouteActivity();
}

export function snapshotHudCompanionDiag(): HudCompanionDiag {
  ensureWindowHook();
  return {
    atMs: Date.now(),
    source: "snapshotHudCompanionDiag",
    coursePeerHud: store.coursePeerHud.map((p) => ({ ...p })),
    activeTrailMemberUids: [...store.activeTrailMemberUids],
    coursePeerNamesLength: store.coursePeerNamesLength,
    publicationId: store.publicationId,
    liveRideRows: store.liveRideRows.map((r) => ({ ...r })),
    motionRowsLength: store.motionRowsLength,
    motionPeersAfterPidFilter: store.motionPeersAfterPidFilter,
    routeActivity: routeActivityForHud(),
  };
}
