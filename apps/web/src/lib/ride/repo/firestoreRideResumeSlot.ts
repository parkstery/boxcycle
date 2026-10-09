/**
 * Firestore 이어달리기 슬롯 레포지터리.
 * users/{uid} 문서의 rideResumeSlot 필드 읽기·쓰기.
 * Rules 완화 없이 owner write 범위 내에서만 동작한다.
 */
import { doc, onSnapshot, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { getFirebaseFirestore } from "../../firebase/app";
import {
  applySlotTransition,
  hasResumableGeometryData,
  isResumableProgressFields,
  parseRideResumeSlot,
  type RideResumeSlot,
} from "../rideResumeSlotPolicy";
import { SAVED_ROUTE_EXPIRY_MS, SAVED_ROUTES_COLLECTION } from "../../route/repo/firestoreSavedRoutes";

const USERS_COLLECTION = "users";

// ---------------------------------------------------------------------------
// 최소 ref 인터페이스 — 실 DocumentReference와 테스트 fake ref가 공유
// ---------------------------------------------------------------------------

export type TxRef = { path: string };
export type TxSnap = { exists(): boolean; data(): Record<string, unknown> };

export type TxLike = {
  get(ref: TxRef): Promise<TxSnap>;
  update(ref: TxRef, data: Record<string, unknown>): unknown;
  set(ref: TxRef, data: Record<string, unknown>, options?: { merge: boolean }): unknown;
};

// ---------------------------------------------------------------------------
// 구독
// ---------------------------------------------------------------------------

/**
 * users/{uid}.rideResumeSlot 실시간 구독.
 * uid guard: 빈 uid 면 즉시 unsub 반환.
 * onError 가 있으면 snapshot 오류를 전달한다(hook status=error).
 */
export function subscribeRideResumeSlot(
  uid: string,
  cb: (slot: RideResumeSlot) => void,
  onError?: (err: Error) => void,
): () => void {
  if (!uid) return () => {};
  const db = getFirebaseFirestore();
  const ref = doc(db, USERS_COLLECTION, uid);
  const unsub = onSnapshot(
    ref,
    (snap) => {
      const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
      cb(parseRideResumeSlot(raw.rideResumeSlot));
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
  return unsub;
}

// ---------------------------------------------------------------------------
// 원자적 트랜잭션 — 테스트 가능한 core 함수
// ---------------------------------------------------------------------------

export type SlotTxOperation =
  | "bootstrap"
  | "acquire"
  | "abandon"
  | "clearIfActive"
  | "markInitializedEmpty";

export type SlotTxArgs = {
  uid: string;
  operation: SlotTxOperation;
  /** acquire/bootstrap/clearIfActive 에 필요 */
  routeId?: string;
  /** abandon 시 기대 active — 낡은 A 종료가 현재 B를 포기시키지 않게 */
  expectedRouteId?: string;
  /** clearIfActive: 호출 uid와 불일치하면 거부(계정 전환 레이스) */
  expectedUid?: string;
  /** clearIfActive: 삭제 직후 강제 해제(유효 미완주 검증 생략) */
  force?: boolean;
  makeUserRef: (uid: string) => TxRef;
  makeRouteRef: (routeId: string) => TxRef;
  now?: string;
};

/** users/{uid} 가 아직(또는 더는) 없다 — 오류가 아니라 「기다림」 */
export const SLOT_USER_DOC_MISSING = "user_doc_missing";

export type SlotTxResult =
  | { ok: true; slot: RideResumeSlot }
  | { ok: false; reason: string; slot: RideResumeSlot };

function writeUserSlot(
  tx: TxLike,
  userRef: TxRef,
  userSnap: TxSnap,
  slot: RideResumeSlot,
): void {
  const slotPayload: Record<string, unknown> = { ...slot };
  if (!userSnap.exists()) throw new Error("rideResumeSlot: users 문서 없이 쓰지 않는다");
  tx.update(userRef, { rideResumeSlot: slotPayload, updatedAt: serverTimestamp() });
}

function restoreRouteTtl(
  tx: TxLike,
  routeRef: TxRef,
  routeData: Record<string, unknown>,
  now: string,
): void {
  if (routeData.completed === 1) return;
  const expiresAtMs = Date.parse(now) + SAVED_ROUTE_EXPIRY_MS;
  tx.update(routeRef, { expiresAt: Timestamp.fromDate(new Date(expiresAtMs)) });
}

/**
 * 이어달리기 슬롯 트랜잭션 core — 실 Firestore transaction 과 테스트 fake tx 모두에서 실행.
 *
 * acquire/bootstrap:
 *   - users/{uid} 읽어 슬롯 파싱
 *   - savedRoutes/{routeId} 읽어 존재·소유·재개 가능(progress/geometry) 확인
 *   - 슬롯이 실제로 획득됐을 때만 expiresAt=null TTL 보호
 *   - 경쟁 acquire: 다른 routeId 활성 중이면 {ok:false, reason:'slot_occupied'}
 *
 * abandon:
 *   - expectedRouteId가 있으면 active와 일치할 때만
 *   - route 미완주이면 expiresAt 복구 (now + SAVED_ROUTE_EXPIRY_MS)
 *
 * clearIfActive:
 *   - active === routeId 일 때만 해제
 *   - expectedUid 불일치 거부
 *   - 서버에 유효 미완주(progress/geometry)면 거부(낡은 완주·삭제 clear 보호)
 *   - 읽기 권한 거절 ≠ 삭제 — clear 금지
 *   - 삭제됨·완주(completed/≥.98)·geometry 무효일 때만 해제; 미완주 잔여면 TTL 복구
 *
 * markInitializedEmpty:
 *   - !initialized 일 때만 initialized=true (TTL 미터치)
 */
export async function applyRideResumeSlotTx(
  tx: TxLike,
  args: SlotTxArgs,
): Promise<SlotTxResult> {
  const {
    uid,
    operation,
    routeId,
    expectedRouteId,
    expectedUid,
    force = false,
    makeUserRef,
    makeRouteRef,
    now = new Date().toISOString(),
  } = args;

  const userRef = makeUserRef(uid);
  const userSnap = await tx.get(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};
  let slot = parseRideResumeSlot(userData.rideResumeSlot);
  // users 문서는 프로필(게스트 tier·닉네임 확정)이 만든다. 슬롯이 만들면 지워진 계정의 열린 탭이
  // 「슬롯만 든」 문서를 되살린다(2026-10-09 운영에서 3건). 문서가 생기면 구독이 다시 부른다.
  if (!userSnap.exists()) return { ok: false, reason: SLOT_USER_DOC_MISSING, slot };

  if (operation === "markInitializedEmpty") {
    if (slot.initialized) return { ok: true, slot };
    slot = applySlotTransition(slot, { type: "markInitializedEmpty" });
    writeUserSlot(tx, userRef, userSnap, slot);
    return { ok: true, slot };
  }

  if (operation === "bootstrap" || operation === "acquire") {
    if (!routeId) return { ok: false, reason: "no_routeId", slot };

    if (operation === "bootstrap" && slot.initialized) {
      // no-op: TTL 보호하지 않음
      return { ok: true, slot };
    }
    if (operation === "acquire") {
      if (!slot.initialized) return { ok: false, reason: "not_initialized", slot };
      if (slot.activeRouteId !== null && slot.activeRouteId !== routeId) {
        return { ok: false, reason: "slot_occupied", slot };
      }
      if (slot.activeRouteId === routeId) {
        return { ok: true, slot };
      }
    }

    const routeRef = makeRouteRef(routeId);
    const routeSnap = await tx.get(routeRef);
    if (!routeSnap.exists()) return { ok: false, reason: "route_not_found", slot };
    const routeData = routeSnap.data();
    if (routeData.userId !== uid) return { ok: false, reason: "ownership_mismatch", slot };
    if (!isResumableProgressFields(routeData)) {
      return { ok: false, reason: "route_not_resumable", slot };
    }
    if (!hasResumableGeometryData(routeData)) {
      return { ok: false, reason: "route_geometry_invalid", slot };
    }

    const next = applySlotTransition(slot, { type: operation, routeId });
    // 실제 획득됐을 때만 TTL 보호
    if (next.activeRouteId !== routeId || next === slot) {
      return {
        ok: false,
        reason: operation === "bootstrap" ? "bootstrap_noop" : "acquire_noop",
        slot,
      };
    }

    tx.update(routeRef, { expiresAt: null });
    slot = next;
    writeUserSlot(tx, userRef, userSnap, slot);
    return { ok: true, slot };
  }

  if (operation === "abandon") {
    if (slot.activeRouteId === null) return { ok: true, slot };
    if (expectedRouteId != null && slot.activeRouteId !== expectedRouteId) {
      return { ok: false, reason: "expected_mismatch", slot };
    }
    const abandonedRouteId = slot.activeRouteId;

    const routeRef = makeRouteRef(abandonedRouteId);
    const routeSnap = await tx.get(routeRef);
    if (routeSnap.exists()) {
      restoreRouteTtl(tx, routeRef, routeSnap.data(), now);
    }

    slot = applySlotTransition(slot, {
      type: "abandon",
      at: now,
      expectedRouteId,
    });
    writeUserSlot(tx, userRef, userSnap, slot);
    return { ok: true, slot };
  }

  if (operation === "clearIfActive") {
    if (!routeId) return { ok: false, reason: "no_routeId", slot };
    if (expectedUid != null && expectedUid !== uid) {
      return { ok: false, reason: "uid_mismatch", slot };
    }
    if (slot.activeRouteId !== routeId) return { ok: true, slot };

    const routeRef = makeRouteRef(routeId);
    let routeSnap: TxSnap;
    try {
      routeSnap = await tx.get(routeRef);
    } catch {
      // 권한 거절·일시 오류를 삭제로 오인해 슬롯을 지우지 않는다.
      return { ok: false, reason: "route_read_denied", slot };
    }

    if (routeSnap.exists()) {
      const routeData = routeSnap.data();
      if (routeData.userId != null && routeData.userId !== uid) {
        return { ok: false, reason: "ownership_mismatch", slot };
      }
      // 아직 유효한 미완주면 낡은 clear 거부(force=삭제 직후만)
      if (
        !force &&
        isResumableProgressFields(routeData) &&
        hasResumableGeometryData(routeData)
      ) {
        return { ok: false, reason: "route_still_resumable", slot };
      }
      // 완주·progress≥.98·geometry 무효 등으로 재개 불능일 때만 TTL 복구 후 해제
      restoreRouteTtl(tx, routeRef, routeData, now);
    }
    // !exists → 진짜 삭제된 것으로 보고 슬롯만 해제(문서 재생성 없음)

    slot = applySlotTransition(slot, { type: "clearIfActive", routeId });
    writeUserSlot(tx, userRef, userSnap, slot);
    return { ok: true, slot };
  }

  return { ok: false, reason: "unknown_operation", slot };
}

// ---------------------------------------------------------------------------
// 실 Firestore 래퍼
// ---------------------------------------------------------------------------

function makeUserRef(uid: string) {
  return doc(getFirebaseFirestore(), USERS_COLLECTION, uid);
}

function makeRouteRef(routeId: string) {
  return doc(getFirebaseFirestore(), SAVED_ROUTES_COLLECTION, routeId);
}

// TxLike 어댑터: 실 Firestore Transaction → TxLike
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapRealTx(tx: any): TxLike {
  return {
    get: (ref) => tx.get(ref),
    update: (ref, data) => tx.update(ref, data),
    set: (ref, data, opts) => (opts ? tx.set(ref, data, opts) : tx.set(ref, data)),
  };
}

export async function acquireRideResumeSlot(uid: string, routeId: string): Promise<SlotTxResult> {
  const db = getFirebaseFirestore();
  return runTransaction(db, async (tx) =>
    applyRideResumeSlotTx(wrapRealTx(tx), {
      uid,
      operation: "acquire",
      routeId,
      makeUserRef,
      makeRouteRef,
    }),
  );
}

export async function bootstrapRideResumeSlot(uid: string, routeId: string): Promise<SlotTxResult> {
  const db = getFirebaseFirestore();
  return runTransaction(db, async (tx) =>
    applyRideResumeSlotTx(wrapRealTx(tx), {
      uid,
      operation: "bootstrap",
      routeId,
      makeUserRef,
      makeRouteRef,
    }),
  );
}

export async function markRideResumeSlotInitializedEmpty(uid: string): Promise<SlotTxResult> {
  const db = getFirebaseFirestore();
  return runTransaction(db, async (tx) =>
    applyRideResumeSlotTx(wrapRealTx(tx), {
      uid,
      operation: "markInitializedEmpty",
      makeUserRef,
      makeRouteRef,
    }),
  );
}

export async function abandonRideResumeSlot(
  uid: string,
  expectedRouteId?: string,
): Promise<SlotTxResult> {
  const db = getFirebaseFirestore();
  return runTransaction(db, async (tx) =>
    applyRideResumeSlotTx(wrapRealTx(tx), {
      uid,
      operation: "abandon",
      expectedRouteId,
      makeUserRef,
      makeRouteRef,
    }),
  );
}

export async function clearRideResumeSlotIfActive(
  uid: string,
  routeId: string,
  options?: { force?: boolean; expectedUid?: string },
): Promise<SlotTxResult> {
  const db = getFirebaseFirestore();
  return runTransaction(db, async (tx) =>
    applyRideResumeSlotTx(wrapRealTx(tx), {
      uid,
      operation: "clearIfActive",
      routeId,
      expectedUid: options?.expectedUid ?? uid,
      force: options?.force,
      makeUserRef,
      makeRouteRef,
    }),
  );
}
