/**
 * S4-3 DEV 게이트 — touch·listing·presence 를 실제 수행 지점에서만 센다.
 * 예약 수를 비용으로 쓰지 마라. 센티넬 0 을 관측치로 쓰지 마라.
 *
 * ① touch 호출(지점별)  ② Trail 문서 updateDoc  ③ Trail 문서 onSnapshot 수신
 * ④ listing 예약/실행/그 안 read  ⑤ presence heartbeat 쓰기  ⑥ 라이더·관전 분모
 */

export const TOUCH_ACTIVITY_SOURCES = [
  "progressTick",
  "presenceHeartbeat",
  "appJoin",
  "joinBurst",
  "routePublish",
  "unspecified",
] as const;

export type TouchActivitySource = (typeof TOUCH_ACTIVITY_SOURCES)[number];

export type TouchCallsBySite = Record<TouchActivitySource, number>;

export type TouchActivitySnapshot = {
  source: "touchActivityMeters";
  totalsAreCumulative: true;
  atMs: number;
  windowMs: number | null;
  riders: number;
  spectators: number;
  touchCallsBySite: TouchCallsBySite;
  touchCallsTotal: number;
  trailUpdateDocTotal: number;
  trailDocSnapshotReceivedTotal: number;
  listingRefreshScheduleTotal: number;
  listingRefreshRunTotal: number;
  listingRefreshReadsTotal: number;
  presenceHeartbeatWriteTotal: number;
};

function emptySites(): TouchCallsBySite {
  return {
    progressTick: 0,
    presenceHeartbeat: 0,
    appJoin: 0,
    joinBurst: 0,
    routePublish: 0,
    unspecified: 0,
  };
}

const meters = {
  touchCallsBySite: emptySites(),
  trailUpdateDocTotal: 0,
  trailDocSnapshotReceivedTotal: 0,
  listingRefreshScheduleTotal: 0,
  listingRefreshRunTotal: 0,
  listingRefreshReadsTotal: 0,
  presenceHeartbeatWriteTotal: 0,
  riders: 0,
  spectators: 0,
};

let listingRefreshReadScope = 0;
let windowStarted: TouchActivitySnapshot | null = null;

function sumSites(sites: TouchCallsBySite): number {
  return TOUCH_ACTIVITY_SOURCES.reduce((n, key) => n + sites[key], 0);
}

export function noteTouchActivityCall(source: TouchActivitySource): void {
  meters.touchCallsBySite[source] += 1;
}

export function noteTrailDocUpdateDoc(): void {
  meters.trailUpdateDocTotal += 1;
}

/** `trails/{id}` onSnapshot 콜백이 실제로 불릴 때만. 구독이 없으면 0 이 맞다. */
export function noteTrailDocSnapshotReceived(): void {
  meters.trailDocSnapshotReceivedTotal += 1;
}

export function noteListingRefreshSchedule(): void {
  meters.listingRefreshScheduleTotal += 1;
}

export function noteListingRefreshRun(): void {
  meters.listingRefreshRunTotal += 1;
}

export function enterListingRefreshReadScope(): void {
  listingRefreshReadScope += 1;
}

export function leaveListingRefreshReadScope(): void {
  listingRefreshReadScope = Math.max(0, listingRefreshReadScope - 1);
}

/** listing 재계산 스코프 안의 getDoc/getDocs 1회. 스코프 밖은 무시. */
export function noteListingRefreshRead(): void {
  if (listingRefreshReadScope <= 0) return;
  meters.listingRefreshReadsTotal += 1;
}

export function notePresenceHeartbeatWrite(): void {
  meters.presenceHeartbeatWriteTotal += 1;
}

export function setTouchMeterDenominators(input: { riders: number; spectators: number }): void {
  meters.riders = Math.max(0, Math.floor(input.riders));
  meters.spectators = Math.max(0, Math.floor(input.spectators));
}

/** DEV·단위시험용. 제품 수명주기에서 호출하지 마라. */
export function resetTouchActivityMeters(): void {
  meters.touchCallsBySite = emptySites();
  meters.trailUpdateDocTotal = 0;
  meters.trailDocSnapshotReceivedTotal = 0;
  meters.listingRefreshScheduleTotal = 0;
  meters.listingRefreshRunTotal = 0;
  meters.listingRefreshReadsTotal = 0;
  meters.presenceHeartbeatWriteTotal = 0;
  meters.riders = 0;
  meters.spectators = 0;
  listingRefreshReadScope = 0;
  windowStarted = null;
}

export function snapshotTouchActivityMeters(): TouchActivitySnapshot {
  const touchCallsBySite = { ...meters.touchCallsBySite };
  return {
    source: "touchActivityMeters",
    totalsAreCumulative: true,
    atMs: Date.now(),
    windowMs: null,
    riders: meters.riders,
    spectators: meters.spectators,
    touchCallsBySite,
    touchCallsTotal: sumSites(touchCallsBySite),
    trailUpdateDocTotal: meters.trailUpdateDocTotal,
    trailDocSnapshotReceivedTotal: meters.trailDocSnapshotReceivedTotal,
    listingRefreshScheduleTotal: meters.listingRefreshScheduleTotal,
    listingRefreshRunTotal: meters.listingRefreshRunTotal,
    listingRefreshReadsTotal: meters.listingRefreshReadsTotal,
    presenceHeartbeatWriteTotal: meters.presenceHeartbeatWriteTotal,
  };
}

export function diffTouchActivitySnapshots(
  start: TouchActivitySnapshot,
  end: TouchActivitySnapshot,
): TouchActivitySnapshot {
  const touchCallsBySite = emptySites();
  for (const key of TOUCH_ACTIVITY_SOURCES) {
    touchCallsBySite[key] = end.touchCallsBySite[key] - start.touchCallsBySite[key];
  }
  return {
    source: "touchActivityMeters",
    totalsAreCumulative: true,
    atMs: end.atMs,
    windowMs: Math.max(0, end.atMs - start.atMs),
    riders: end.riders,
    spectators: end.spectators,
    touchCallsBySite,
    touchCallsTotal: end.touchCallsTotal - start.touchCallsTotal,
    trailUpdateDocTotal: end.trailUpdateDocTotal - start.trailUpdateDocTotal,
    trailDocSnapshotReceivedTotal:
      end.trailDocSnapshotReceivedTotal - start.trailDocSnapshotReceivedTotal,
    listingRefreshScheduleTotal: end.listingRefreshScheduleTotal - start.listingRefreshScheduleTotal,
    listingRefreshRunTotal: end.listingRefreshRunTotal - start.listingRefreshRunTotal,
    listingRefreshReadsTotal: end.listingRefreshReadsTotal - start.listingRefreshReadsTotal,
    presenceHeartbeatWriteTotal:
      end.presenceHeartbeatWriteTotal - start.presenceHeartbeatWriteTotal,
  };
}

export function beginTouchMeterWindow(denominators?: { riders: number; spectators: number }): void {
  if (denominators) setTouchMeterDenominators(denominators);
  windowStarted = snapshotTouchActivityMeters();
}

export function endTouchMeterWindow(): TouchActivitySnapshot {
  const end = snapshotTouchActivityMeters();
  const start = windowStarted ?? end;
  windowStarted = null;
  return diffTouchActivitySnapshots(start, end);
}
