/**
 * Guest(익명 인증) 이어달리기 슬롯 — localStorage 전용.
 * uid 별로 격리, storage event 로 다른 탭 동기화.
 * 전역 savedRoutesLocal 과 섞이지 않도록 슬롯 연산은 호출부가 넘긴 routes만 사용한다.
 * 탭 간 배타: navigator.locks (UID별). 미지원 시 단일 탭 fallback(동시 획득 성공을 주장하지 않음).
 */
import {
  applySlotTransition,
  emptyRideResumeSlot,
  isResumableRoute,
  parseRideResumeSlot,
  type RideResumeSlot,
} from "../rideResumeSlotPolicy";
import {
  SAVED_ROUTE_EXPIRY_MS,
  type SavedRoute,
} from "../../route/repo/firestoreSavedRoutes";
import { updateSavedRouteExpiresAtInLocal } from "../../route/repo/savedRoutesLocal";

function slotKey(uid: string): string {
  return `boxcycle_ride_resume_slot_v1_${uid}`;
}

function webLockName(uid: string): string {
  return `boxcycle-ride-resume-slot-${uid}`;
}

function readSlot(uid: string): RideResumeSlot {
  try {
    const raw = localStorage.getItem(slotKey(uid));
    if (!raw) return emptyRideResumeSlot();
    return parseRideResumeSlot(JSON.parse(raw) as unknown);
  } catch {
    return emptyRideResumeSlot();
  }
}

function writeSlot(uid: string, slot: RideResumeSlot): void {
  localStorage.setItem(slotKey(uid), JSON.stringify(slot));
}

/** 읽기→쓰기 경쟁 보완: 기대 슬롯과 다를 때 실패 */
function casWriteSlot(uid: string, expected: RideResumeSlot, next: RideResumeSlot): boolean {
  const current = readSlot(uid);
  if (JSON.stringify(current) !== JSON.stringify(expected)) return false;
  writeSlot(uid, next);
  return true;
}

/**
 * UID별 exclusive lock.
 * Web Locks 미지원·거부 시 busy 반환(단일 탭 fallback만 — 다중 탭 동시 획득을 보장하지 않음).
 */
async function withLocalSlotLock<T>(uid: string, fn: () => T): Promise<T | null> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== "function") {
    // 미지원: 동일 틱 재진입만 막는 최소 fallback. 다중 탭 exclusive 아님.
    try {
      return fn();
    } catch {
      return null;
    }
  }
  try {
    return await locks.request(webLockName(uid), { mode: "exclusive" }, async () => fn());
  } catch {
    return null;
  }
}

/** TTL 보호 후 슬롯 쓰기가 실패하면 TTL을 이전 값으로 되돌린다. */
function protectTtlThenWriteSlot(
  uid: string,
  expected: RideResumeSlot,
  next: RideResumeSlot,
  routeId: string,
  previousExpiresAtIso: string | null | undefined,
): LocalSlotResult {
  try {
    updateSavedRouteExpiresAtInLocal(routeId, null);
  } catch {
    return { ok: false, reason: "ttl_write_failed", slot: expected };
  }
  try {
    if (!casWriteSlot(uid, expected, next)) {
      try {
        updateSavedRouteExpiresAtInLocal(routeId, previousExpiresAtIso ?? null);
      } catch {
        /* rollback best-effort */
      }
      return { ok: false, reason: "cas_conflict", slot: readSlot(uid) };
    }
  } catch {
    try {
      updateSavedRouteExpiresAtInLocal(routeId, previousExpiresAtIso ?? null);
    } catch {
      /* rollback best-effort */
    }
    return { ok: false, reason: "slot_write_failed", slot: expected };
  }
  return { ok: true, slot: next };
}

export function readLocalRideResumeSlot(uid: string): RideResumeSlot {
  return readSlot(uid);
}

/** storage event 핸들러를 등록해 다른 탭의 슬롯 변경을 감지한다. unsub 반환 */
export function subscribeLocalRideResumeSlot(
  uid: string,
  cb: (slot: RideResumeSlot) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const key = slotKey(uid);
  const handler = (e: StorageEvent) => {
    if (e.key !== key) return;
    cb(readSlot(uid));
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export type LocalSlotResult =
  | { ok: true; slot: RideResumeSlot }
  | { ok: false; reason: string; slot: RideResumeSlot };

export type LocalClearOptions = {
  /** 경로 삭제 직후 — 목록에 남아 있어도 슬롯만 강제 해제 */
  force?: boolean;
};

/**
 * acquire — initialized && activeRouteId===null 일 때만 획득.
 * route가 호출부가 넘긴 목록에 있고 재개 가능하면 expiresAt=null 로 TTL 보호.
 */
export async function acquireLocalRideResumeSlot(
  uid: string,
  routeId: string,
  routes: readonly SavedRoute[],
): Promise<LocalSlotResult> {
  const locked = await withLocalSlotLock(uid, () => {
    const slot = readSlot(uid);
    if (slot.activeRouteId !== null && slot.activeRouteId !== routeId) {
      return { ok: false as const, reason: "slot_occupied", slot };
    }
    if (slot.activeRouteId === routeId) return { ok: true as const, slot };
    if (!slot.initialized) return { ok: false as const, reason: "not_initialized", slot };

    const route = routes.find((r) => r.id === routeId);
    if (!route) return { ok: false as const, reason: "route_not_found", slot };
    if (!isResumableRoute(route)) {
      return { ok: false as const, reason: "route_not_resumable", slot };
    }

    const next = applySlotTransition(slot, { type: "acquire", routeId });
    if (next.activeRouteId !== routeId) {
      return { ok: false as const, reason: "acquire_noop", slot };
    }
    return protectTtlThenWriteSlot(uid, slot, next, routeId, route.expiresAtIso);
  });
  if (locked == null) {
    return { ok: false, reason: "lock_busy", slot: readSlot(uid) };
  }
  return locked;
}

/**
 * bootstrap — !initialized 일 때만 획득.
 * 실제 획득됐을 때만 TTL 보호.
 */
export async function bootstrapLocalRideResumeSlot(
  uid: string,
  routeId: string,
  routes: readonly SavedRoute[],
): Promise<LocalSlotResult> {
  const locked = await withLocalSlotLock(uid, () => {
    const slot = readSlot(uid);
    if (slot.initialized) return { ok: true as const, slot };

    const route = routes.find((r) => r.id === routeId);
    if (!route) return { ok: false as const, reason: "route_not_found", slot };
    if (!isResumableRoute(route)) {
      return { ok: false as const, reason: "route_not_resumable", slot };
    }

    const next = applySlotTransition(slot, { type: "bootstrap", routeId });
    if (next.activeRouteId !== routeId) {
      return { ok: false as const, reason: "bootstrap_noop", slot };
    }
    return protectTtlThenWriteSlot(uid, slot, next, routeId, route.expiresAtIso);
  });
  if (locked == null) {
    return { ok: false, reason: "lock_busy", slot: readSlot(uid) };
  }
  return locked;
}

/** markInitializedEmpty — 재개 후보가 없을 때 초기화 완료 표시 */
export async function markLocalSlotInitializedEmpty(uid: string): Promise<RideResumeSlot> {
  const locked = await withLocalSlotLock(uid, () => {
    const slot = readSlot(uid);
    if (slot.initialized) return slot;
    const next = applySlotTransition(slot, { type: "markInitializedEmpty" });
    casWriteSlot(uid, slot, next);
    return readSlot(uid);
  });
  return locked ?? readSlot(uid);
}

/**
 * abandon — 활성 경로를 명시 종료.
 * expectedRouteId가 있으면 일치할 때만. 미완주이면 expiresAt 복구(updatedAt 미변경).
 */
export async function abandonLocalRideResumeSlot(
  uid: string,
  routes: readonly SavedRoute[],
  expectedRouteId?: string,
): Promise<LocalSlotResult> {
  const locked = await withLocalSlotLock(uid, () => {
    const slot = readSlot(uid);
    if (slot.activeRouteId === null) return { ok: true as const, slot };
    if (expectedRouteId != null && slot.activeRouteId !== expectedRouteId) {
      return { ok: false as const, reason: "expected_mismatch", slot };
    }

    const abandonedId = slot.activeRouteId;
    const route = routes.find((r) => r.id === abandonedId);
    if (route && route.completed !== 1) {
      const expiresAtIso = new Date(Date.now() + SAVED_ROUTE_EXPIRY_MS).toISOString();
      try {
        updateSavedRouteExpiresAtInLocal(abandonedId, expiresAtIso);
      } catch {
        return { ok: false as const, reason: "ttl_write_failed", slot };
      }
    }

    const now = new Date().toISOString();
    const next = applySlotTransition(slot, {
      type: "abandon",
      at: now,
      expectedRouteId,
    });
    try {
      if (!casWriteSlot(uid, slot, next)) {
        return { ok: false as const, reason: "cas_conflict", slot: readSlot(uid) };
      }
    } catch {
      return { ok: false as const, reason: "slot_write_failed", slot };
    }
    return { ok: true as const, slot: next };
  });
  if (locked == null) {
    return { ok: false, reason: "lock_busy", slot: readSlot(uid) };
  }
  return locked;
}

/**
 * clearIfActive — routeId가 활성일 때만 해제.
 * 목록에 아직 유효한 미완주 경로면 거부(낡은 완주/삭제 clear 보호).
 * force: 삭제 직후 강제 해제.
 */
export async function clearLocalRideResumeSlotIfActive(
  uid: string,
  routeId: string,
  routes?: readonly SavedRoute[],
  options?: LocalClearOptions,
): Promise<LocalSlotResult> {
  const locked = await withLocalSlotLock(uid, () => {
    const slot = readSlot(uid);
    if (slot.activeRouteId !== routeId) return { ok: true as const, slot };

    const route = routes?.find((r) => r.id === routeId);
    if (!options?.force && route && isResumableRoute(route)) {
      return { ok: false as const, reason: "route_still_resumable", slot };
    }

    if (route && route.completed !== 1) {
      const expiresAtIso = new Date(Date.now() + SAVED_ROUTE_EXPIRY_MS).toISOString();
      try {
        updateSavedRouteExpiresAtInLocal(routeId, expiresAtIso);
      } catch {
        return { ok: false as const, reason: "ttl_write_failed", slot };
      }
    }

    const next = applySlotTransition(slot, { type: "clearIfActive", routeId });
    try {
      if (!casWriteSlot(uid, slot, next)) {
        return { ok: false as const, reason: "cas_conflict", slot: readSlot(uid) };
      }
    } catch {
      return { ok: false as const, reason: "slot_write_failed", slot };
    }
    return { ok: true as const, slot: next };
  });
  if (locked == null) {
    return { ok: false, reason: "lock_busy", slot: readSlot(uid) };
  }
  return locked;
}
