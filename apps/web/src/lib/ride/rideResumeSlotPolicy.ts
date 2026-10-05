/**
 * 단일 이어달리기 슬롯 정책 — 순수 함수 레이어.
 * I/O 없음. Firestore·localStorage·React 의존 없음.
 */
import type { SavedRoute } from "../route/repo/firestoreSavedRoutes";
import { ROUTE_COMPLETION_RATIO_THRESHOLD } from "./rideRecordPolicy";
import { resumeAnchorForRoute } from "./nextRideTarget";
import type { StoredRideSession } from "./rideSessionsStorage";

export const RIDE_RESUME_SLOT_VERSION = 1 as const;

export type RideResumeSlot = {
  v: 1;
  /** 현재 활성 이어달리기 경로 id. null=빈 슬롯 */
  activeRouteId: string | null;
  /** bootstrap 완료 여부 — false 면 아직 초기화 전 */
  initialized: boolean;
  /** 마지막 명시 포기(abandon)한 경로 정보 — 재 bootstrap 방지용 tombstone */
  lastProcessedEnd: { routeId: string; at: string } | null;
};

/** 슬롯 전이 연산 타입 */
export type SlotOp =
  | { type: "markInitializedEmpty" }
  | { type: "bootstrap"; routeId: string }
  | { type: "acquire"; routeId: string }
  | { type: "abandon"; at: string; expectedRouteId?: string }
  | { type: "clearIfActive"; routeId: string };

/** A가 활성이면 B로 교체하지 않는다는 안내 */
export const RESUME_SLOT_BLOCKED_MSG = "이어달리기는 한 경로만 유지합니다";

export function emptyRideResumeSlot(): RideResumeSlot {
  return { v: 1, activeRouteId: null, initialized: false, lastProcessedEnd: null };
}

export function parseRideResumeSlot(raw: unknown): RideResumeSlot {
  if (!raw || typeof raw !== "object") return emptyRideResumeSlot();
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return emptyRideResumeSlot();
  const activeRouteId = typeof r.activeRouteId === "string" ? r.activeRouteId : null;
  const initialized = Boolean(r.initialized);
  let lastProcessedEnd: { routeId: string; at: string } | null = null;
  if (r.lastProcessedEnd && typeof r.lastProcessedEnd === "object") {
    const lpe = r.lastProcessedEnd as Record<string, unknown>;
    if (typeof lpe.routeId === "string" && typeof lpe.at === "string") {
      lastProcessedEnd = { routeId: lpe.routeId, at: lpe.at };
    }
  }
  return { v: 1, activeRouteId, initialized, lastProcessedEnd };
}

/**
 * Firestore/local raw 문서에서 재개 가능 여부(진행률·완주).
 * geometry 유효성은 호출부가 별도 확인한다.
 */
export function isResumableProgressFields(data: {
  completed?: unknown;
  lastProgressRatio?: unknown;
}): boolean {
  if (data.completed === 1) return false;
  const p = Number(data.lastProgressRatio);
  return Number.isFinite(p) && p > 0 && p < ROUTE_COMPLETION_RATIO_THRESHOLD;
}

/** Firestore 문서의 geometry 필드가 재개 가능한지(최소 LineString 좌표 2점). */
export function hasResumableGeometryData(data: Record<string, unknown>): boolean {
  const json = data.geometryCoordsJson;
  if (typeof json === "string") {
    try {
      const coords = JSON.parse(json) as unknown;
      return Array.isArray(coords) && coords.length >= 2;
    } catch {
      return false;
    }
  }
  const legacy = data.geometry as { type?: string; coordinates?: unknown } | undefined;
  return (
    legacy?.type === "LineString" &&
    Array.isArray(legacy.coordinates) &&
    legacy.coordinates.length >= 2
  );
}

/**
 * 이어달리기 후보가 될 수 있는 경로인가.
 * - 미완주(completed !== 1)
 * - 진행률이 0 초과 0.98 미만
 * - 재개 좌표(anchor)가 계산 가능
 */
export function isResumableRoute(route: SavedRoute): boolean {
  if (!isResumableProgressFields(route)) return false;
  return resumeAnchorForRoute(route) != null;
}

/** tombstone 이후 해당 경로에 새 의미 있는 Ride 가 있는가(이름 변경 updatedAt 만으로는 false). */
export function hasMeaningfulRideAfterTombstone(input: {
  routeId: string;
  rides: readonly StoredRideSession[];
  lastProcessedEnd: { routeId: string; at: string } | null;
}): boolean {
  const { routeId, rides, lastProcessedEnd } = input;
  if (!lastProcessedEnd || lastProcessedEnd.routeId !== routeId) return true;
  return rides.some(
    (ride) => ride.userRouteId === routeId && ride.endedAt > lastProcessedEnd.at,
  );
}

/**
 * bootstrap 시 자동으로 활성화할 경로 id 선택.
 * - 재개 가능 경로 중 tombstone(명시 포기 후 새 Ride 없음) 제외
 * - 가장 최근 관련 Ride endedAt → route.updatedAtIso 순으로 정렬해 1개 반환
 */
export function pickBootstrapRouteId(input: {
  routes: readonly SavedRoute[];
  rides: readonly StoredRideSession[];
  slot: RideResumeSlot;
}): string | null {
  const { routes, rides, slot } = input;

  const candidates = routes.filter((r) => {
    if (!isResumableRoute(r)) return false;
    if (
      !hasMeaningfulRideAfterTombstone({
        routeId: r.id,
        rides,
        lastProcessedEnd: slot.lastProcessedEnd,
      })
    ) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) return null;

  function latestRideEndedAt(routeId: string): string {
    let best = "";
    for (const ride of rides) {
      if (ride.userRouteId === routeId && ride.endedAt > best) {
        best = ride.endedAt;
      }
    }
    return best;
  }

  const sorted = [...candidates].sort((a, b) => {
    const aRide = latestRideEndedAt(a.id);
    const bRide = latestRideEndedAt(b.id);
    if (bRide !== aRide) return bRide.localeCompare(aRide);
    return b.updatedAtIso.localeCompare(a.updatedAtIso);
  });

  return sorted[0]?.id ?? null;
}

/**
 * 슬롯 상태 순수 전이.
 * - markInitializedEmpty: initialized=true, activeRouteId=null
 * - bootstrap: !initialized 일 때만 활성화 (이미 initialized면 no-op)
 * - acquire: initialized && activeRouteId===null 일 때만; 다른 id 활성 중이면 no-op
 * - abandon: expectedRouteId가 있으면 일치할 때만 해제 + lastProcessedEnd
 * - clearIfActive: 지정 id가 active일 때만 해제
 */
export function applySlotTransition(slot: RideResumeSlot, op: SlotOp): RideResumeSlot {
  switch (op.type) {
    case "markInitializedEmpty":
      return { ...slot, initialized: true, activeRouteId: null };
    case "bootstrap": {
      if (slot.initialized) return slot;
      return { ...slot, initialized: true, activeRouteId: op.routeId };
    }
    case "acquire": {
      if (!slot.initialized) return slot;
      if (slot.activeRouteId === op.routeId) return slot;
      if (slot.activeRouteId !== null) return slot;
      return { ...slot, activeRouteId: op.routeId };
    }
    case "abandon": {
      if (slot.activeRouteId === null) return slot;
      if (op.expectedRouteId != null && slot.activeRouteId !== op.expectedRouteId) {
        return slot;
      }
      return {
        ...slot,
        activeRouteId: null,
        initialized: true,
        lastProcessedEnd: { routeId: slot.activeRouteId, at: op.at },
      };
    }
    case "clearIfActive": {
      if (slot.activeRouteId !== op.routeId) return slot;
      return { ...slot, activeRouteId: null };
    }
  }
}

/** 이 routeId에 대해 이어달리기 오프셋을 쓸 수 있는가 (활성 슬롯과 일치) */
export function canResumeOffset(activeRouteId: string | null, routeId: string): boolean {
  return activeRouteId === routeId;
}

/** 다른 경로가 활성 중이어서 이 routeId의 이어달리기가 막혔는가 */
export function isResumeBlockedBySlot(activeRouteId: string | null, routeId: string): boolean {
  return activeRouteId !== null && activeRouteId !== routeId;
}

/**
 * 주행 종료 결과 → 슬롯 확보/해제 시도 여부.
 * progress pending이면 wait(재실행 대기). success 후에만 acquire/clear.
 */
export type RideEndSlotAction = "wait" | "acquire" | "clear" | "skip";

export function resolveRideEndSlotAction(input: {
  savedRouteId: string | null | undefined;
  routeCompleted: boolean;
  savedRouteProgressStatus?: "pending" | "success" | "failed" | "n/a" | null;
  slotStatus: "idle" | "loading" | "ready" | "error";
  slotInitialized: boolean;
  slotOwnerUid: string | null;
  currentUid: string | null;
  recordId: string;
  alreadyProcessed: boolean;
}): RideEndSlotAction {
  const {
    savedRouteId,
    routeCompleted,
    savedRouteProgressStatus,
    slotStatus,
    slotInitialized,
    slotOwnerUid,
    currentUid,
    alreadyProcessed,
  } = input;
  if (!savedRouteId || !currentUid) return "skip";
  if (alreadyProcessed) return "skip";
  if (slotOwnerUid !== currentUid) return "wait";
  if (slotStatus !== "ready" || !slotInitialized) return "wait";

  const progress = savedRouteProgressStatus ?? "n/a";
  if (progress === "pending") return "wait";
  if (progress === "failed") return "skip";
  if (progress !== "success" && progress !== "n/a") return "skip";

  return routeCompleted ? "clear" : "acquire";
}

/** ensureAcquired/clear 결과로 processed 마커를 찍어도 되는가 */
export function shouldMarkSlotOpProcessed(reasonOrOk: { ok: true } | { ok: false; reason: string }): boolean {
  if (reasonOrOk.ok) return true;
  return reasonOrOk.reason === "slot_occupied" || reasonOrOk.reason === "uid_mismatch";
}

/** progress 성공 이벤트(UI result 와 독립). rideEndPersistence 와 동일 shape. */
export type ProgressAppliedSlotEvent = {
  userId: string;
  recordId: string;
  routeId: string;
  routeCompleted: boolean;
};

/**
 * 현재 UID 에 속한 이벤트만 남긴다.
 * UID 전환 후 늦은 성공이 다른 계정 슬롯에 적용되지 않게 한다.
 */
export function filterProgressAppliedEventsForUid(
  events: readonly ProgressAppliedSlotEvent[],
  currentUid: string | null,
): ProgressAppliedSlotEvent[] {
  if (!currentUid) return [];
  return events.filter((e) => e.userId === currentUid);
}

/**
 * 큐에서 아직 처리하지 않은 다음 이벤트(FIFO).
 * 마지막 덮어쓰기로 선행 이벤트를 버리지 않는다.
 */
export function peekNextProgressAppliedEvent(
  events: readonly ProgressAppliedSlotEvent[],
  processedRecordIds: ReadonlySet<string>,
): ProgressAppliedSlotEvent | null {
  for (const e of events) {
    if (!processedRecordIds.has(e.recordId)) return e;
  }
  return null;
}
