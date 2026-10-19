/**
 * Admin 개인자료 writer 공용 guard — guestLifecycle tombstone 경합을 transaction 안에서 직렬화.
 *
 * Rules는 Admin SDK 쓰기를 막지 못한다(07-supervisor-integration-findings 「Admin 쓰기 우회」).
 * users·conquest·routeTokenLedger 같은 사용자 자료를 쓰는 Admin 코드는 guestLifecycle/{uid}
 * marker를 **쓰기 전에 같은 transaction 안에서 읽고**, blocking 상태
 * (deletionScheduled·disabling·deleting·failed·deleted)면 쓰기를 거절해야 한다.
 *
 * 함수 입구의 사전 확인만으로는 경합이 사라지지 않는다:
 * - sweep 의 arm/deleted 마커 쓰기가 writer transaction 진행 중에 커밋되는 경합
 * - rides 생성 수 분 뒤에 늦게 도는 지연 CloudEvent(mileage·conquest·routeToken trigger)
 * marker 읽기를 transaction read 집합에 넣으면 Firestore transaction 충돌 감지가 marker
 * 쓰기와의 경합을 abort·재시도로 직렬화하고, 재시도한 transaction은 blocking marker를
 * 읽고 도중에 던져 그 transaction의 쓰기가 전부 폐기된다.
 *
 * marker가 없거나 active·linking·exempt인 정상 Google/Guest 는 기존 동작 그대로다 —
 * guard 는 marker 문서를 읽기만 하고 쓰지 않는다.
 */
import type { Firestore, Transaction } from "firebase-admin/firestore";
import {
  GUEST_WRITE_BLOCK_STATUSES,
  guestLifecyclePath,
  type GuestWriteBlockStatus,
} from "./guestLifecycleCore.js";

/** HttpsError 계약을 주는 게이트 결정 코드 — 응답은 각 HTTP 수신부가 mapping 한다. */
export const GUEST_LIFECYCLE_BLOCKED_CODE = "guest-lifecycle/blocked";

/** tombstone 뒤 요청 일관 멘트 — HTTP 403 본문·로그 공용 */
export const GUEST_LIFECYCLE_BLOCKED_MESSAGE =
  "계정 정리가 진행 중이거나 삭제된 상태에서는 요청을 처리하지 않습니다.";

export class GuestLifecycleBlockedError extends Error {
  readonly code = GUEST_LIFECYCLE_BLOCKED_CODE;
  readonly guestLifecycleStatus: GuestWriteBlockStatus;

  constructor(status: GuestWriteBlockStatus, uid: string) {
    super(`guestLifecycle tombstone(${status}) 뒤의 사용자 자료 쓰기가 거절됐다 — uid=${uid}`);
    this.name = "GuestLifecycleBlockedError";
    this.guestLifecycleStatus = status;
  }
}

export function isGuestLifecycleBlockedError(error: unknown): error is GuestLifecycleBlockedError {
  return error instanceof GuestLifecycleBlockedError;
}

/** blocking 상태 5값으로 좁힌다. 그 이외(active·linking·exempt·unknown 필드)는 null. */
export function guestWriteBlockStatusOf(status: unknown): GuestWriteBlockStatus | null {
  if (typeof status !== "string") return null;
  for (const candidate of GUEST_WRITE_BLOCK_STATUSES) {
    if (candidate === status) return candidate;
  }
  return null;
}

type MarkerSnapLike = { exists: boolean; get(field: string): unknown };

function blockedStatusFromMarkerSnap(snap: MarkerSnapLike | null | undefined): GuestWriteBlockStatus | null {
  if (!snap?.exists) return null;
  return guestWriteBlockStatusOf(snap.get("status"));
}

/**
 * transaction 안 marker 검문 — Admin writer transaction 본문의 **첫 동작**으로 호출한다.
 * 여기에서 던진 실패는 그 transaction의 쓰기(set·update·delete)를 전부 폐기시킨다.
 */
export async function assertGuestLifecycleWritableInTx(
  tx: Pick<Transaction, "get">,
  db: Firestore,
  uid: string,
): Promise<void> {
  const snap = (await tx.get(db.doc(guestLifecyclePath(uid)))) as unknown as MarkerSnapLike;
  const blocked = blockedStatusFromMarkerSnap(snap);
  if (blocked) throw new GuestLifecycleBlockedError(blocked, uid);
}

/**
 * transaction 밖 1차 게이트(HTTP 입구). tombstone 뒤 요청을 이 단계에서 끊어
 * 이후 개인자료 생성 코드가 아예 실행되지 않게 한다. 진짜 직렬화는 위 InTx 검문이다.
 */
export async function assertGuestLifecycleWritable(db: Firestore, uid: string): Promise<void> {
  const snap = await db.doc(guestLifecyclePath(uid)).get();
  const blocked = blockedStatusFromMarkerSnap(snap as unknown as MarkerSnapLike);
  if (blocked) throw new GuestLifecycleBlockedError(blocked, uid);
}
