/**
 * 계정 탈퇴 — 데이터 처리(2026-10-06 Chief 결정, document/ops/20261006-account-deletion/01-plan.md §7).
 *
 * - 즉시 삭제(유예 없음). 마지막에 Auth 계정을 지운다.
 * - 개인 데이터는 삭제, 다른 사용자와 얽힌 공용 자산은 **익명화**해 남긴다.
 *   · 내가 등록한 퍼블릭 경로(routePublications.applicantUid) → applicantUid "" + publisherDeleted
 *   · 최초 정복: 현행 정복(v2)은 사용자별 `conquest/{uid}` 뿐이라 공용 기록이 없다.
 *     v1 `pioneerChunks` 는 유휴(cliPurgeConquestV1 정리 대상) — 익명화 대상 없음.
 * - 토큰 원장(routeTokenLedger) 삭제.
 * - 게스트(익명) 계정은 서버 탈퇴 대상이 아니다 — 앱의 「이 기기 데이터 지우기」.
 *
 * 개인 데이터 삭제 범위는 게스트 일괄 정리(purgeGuestUsersCore)와 같다 — 그 함수를 그대로 쓴다.
 * 여러 번 호출해도 안전하다(없는 문서 삭제·이미 익명화된 문서 갱신은 무해).
 */
import type { Firestore } from "firebase-admin/firestore";
import type { Database } from "firebase-admin/database";
import {
  buildPresenceIndex,
  deleteGuestUidFirestoreData,
  type PresenceIndex,
} from "./purgeGuestUsersCore.js";

/** 퍼블릭 경로 등록자 표시 — 클라이언트는 publisherDeleted 면 이 문구를 쓴다 */
export const DELETED_PUBLISHER_LABEL = "탈퇴한 라이더";

/** 계정 삭제는 최근 로그인(초) 안에서만 — Firebase 권장과 같은 5분 */
export const ACCOUNT_DELETION_MAX_AUTH_AGE_SEC = 5 * 60;

export type AccountDeletionAction = "delete" | "anonymize" | "none";

/**
 * Firestore 최상위 컬렉션별 탈퇴 처리 — **단일 진실**.
 * 새 컬렉션이 생기면 여기 분류를 넣지 않는 한 계약 테스트(accountDeletionCore.test)가 실패한다
 * (탈퇴 누락 방지 게이트). 「none」 은 사용자 개인 데이터가 없는 컬렉션.
 */
export const ACCOUNT_DELETION_POLICY: Readonly<Record<string, AccountDeletionAction>> = {
  users: "delete",
  userPrivate: "delete", // 본인 전용 설정(체중·강도)
  nicknames: "delete",
  livePresence: "delete",
  openTrailListings: "delete", // 내가 연 목록(hostUid)
  trails: "none", // Trail 기록 자체는 공용 — members/{uid} 하위만 삭제(아래 하위 컬렉션)
  rooms: "none", // 구 Room(유휴)
  rides: "delete",
  savedRoutes: "delete",
  config: "none",
  publicRouteRequests: "delete",
  routePublications: "anonymize",
  publicationSessions: "none", // members/{uid} 하위만 삭제
  appMeta: "none",
  routeActivity: "none", // 경로별 집계(개인 식별 없음)
  publicationPresence: "none", // 경로별 접속 카운트
  routeElevations: "none",
  worldActivity: "none", // 타일 집계
  conquest: "delete", // conquest/{uid} + chunks·traces
  pioneerChunks: "none", // v1 유휴 — 현행 공용 최초 정복 기록 없음
  routeTokenLedger: "delete",
  billingProcessedEvents: "none", // Stripe 이벤트 id 멱등 기록
  accountDeletions: "none", // 탈퇴 진행 기록(본 기능)
};

/** 사용자별 하위 컬렉션(문서 id = uid) — 상위가 「none」이어도 여기는 지운다 */
export const ACCOUNT_DELETION_SUBCOLLECTIONS = [
  "trails/{trailId}/members/{uid}",
  "trails/{trailId}/livePublicationRides/{uid}",
  "publicationSessions/{publicationId}/members/{uid}",
  "conquest/{uid}/chunks",
  "conquest/{uid}/traces",
] as const;

/** Realtime DB — trails/{trailId}/motion/{uid} */
export const ACCOUNT_DELETION_RTDB_PATHS = ["trails/{trailId}/motion/{uid}"] as const;

/** 계정 삭제는 최근에 로그인한 경우에만(토큰 auth_time 기준) */
export function isRecentSignIn(
  authTimeSec: number | undefined,
  nowMs: number,
  maxAgeSec: number = ACCOUNT_DELETION_MAX_AUTH_AGE_SEC,
): boolean {
  if (typeof authTimeSec !== "number" || !Number.isFinite(authTimeSec)) return false;
  const ageSec = nowMs / 1000 - authTimeSec;
  return ageSec >= -60 && ageSec <= maxAgeSec;
}

/** 닉네임 키 정규화(nicknames/{key} 와 같은 규칙: 앞뒤 공백 제거·소문자) */
export function normalizeNicknameForConfirm(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** 탈퇴 확인 문구 — 사용자가 직접 입력해야 진행된다(앱·서버 동일) */
export const ACCOUNT_DELETION_CONFIRM_PHRASE = "탈퇴";

export function isDeletionConfirmPhrase(typed: unknown): boolean {
  return typeof typed === "string" && typed.trim() === ACCOUNT_DELETION_CONFIRM_PHRASE;
}

/** presence 인덱스에서 사용자가 걸린 trailId 들(RTDB motion 정리용) */
export function trailIdsForUid(presence: PresenceIndex, uid: string): string[] {
  const ids = new Set<string>();
  for (const ref of presence.trailMembersByUid.get(uid) ?? []) {
    const trailId = ref.parent.parent?.id;
    if (trailId) ids.add(trailId);
  }
  for (const ref of presence.trailsByHostUid.get(uid) ?? []) ids.add(ref.id);
  for (const ref of presence.livePublicationRidesByUid.get(uid) ?? []) {
    const parentId = ref.parent.parent?.id;
    if (parentId) ids.add(parentId);
  }
  return [...ids];
}

export type AccountDeletionReport = {
  uid: string;
  firestoreDocsDeleted: number;
  nicknameReleased: boolean;
  publicationsAnonymized: number;
  rtdbMotionNodesRemoved: number;
};

/** 내가 등록한 퍼블릭 경로 익명화 — 경로·다른 라이더 기록은 그대로 */
export async function anonymizeOwnedPublications(db: Firestore, uid: string): Promise<number> {
  const snap = await db.collection("routePublications").where("applicantUid", "==", uid).get();
  let n = 0;
  for (const d of snap.docs) {
    await d.ref.update({ applicantUid: "", publisherDeleted: true });
    n += 1;
  }
  return n;
}

/** nicknames/{key} 예약 해제 — 그 키가 이 uid 를 가리킬 때만(ownerUid) */
export async function releaseNickname(db: Firestore, uid: string, nickname: unknown): Promise<boolean> {
  const key = normalizeNicknameForConfirm(nickname);
  if (!key) return false;
  const ref = db.doc(`nicknames/${key}`);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const owner = snap.get("ownerUid");
  if (owner !== uid) return false;
  await ref.delete();
  return true;
}

/**
 * Firestore·RTDB 의 사용자 데이터를 처리한다(Auth 삭제·Stripe 해지는 호출 측).
 * 순서: 라이브 흔적(RTDB) → 익명화 → 닉네임 → 개인 문서 일괄 삭제(users 포함).
 * users 를 마지막 묶음에서 지우므로 중간 실패 후 재실행해도 닉네임을 다시 찾을 수 있다.
 */
export async function deleteAccountData(
  db: Firestore,
  rtdb: Database | null,
  uid: string,
): Promise<AccountDeletionReport> {
  const userSnap = await db.doc(`users/${uid}`).get();
  const nickname = userSnap.exists ? userSnap.get("nickname") : null;

  const presence = await buildPresenceIndex(db);

  let rtdbMotionNodesRemoved = 0;
  if (rtdb) {
    for (const trailId of trailIdsForUid(presence, uid)) {
      await rtdb.ref(`trails/${trailId}/motion/${uid}`).remove();
      rtdbMotionNodesRemoved += 1;
    }
  }

  const publicationsAnonymized = await anonymizeOwnedPublications(db, uid);
  const nicknameReleased = await releaseNickname(db, uid, nickname);
  const firestoreDocsDeleted = await deleteGuestUidFirestoreData(db, uid, presence);

  return { uid, firestoreDocsDeleted, nicknameReleased, publicationsAnonymized, rtdbMotionNodesRemoved };
}
