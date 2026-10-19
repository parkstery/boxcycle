/**
 * Guest 수명 포트를 Admin SDK 에 연결한다. 판정은 guestLifecycleCore 가 한다.
 *
 * 후보 uid 는 Auth 목록과 개인 귀속 원장을 합친다. users 문서가 없어도
 * rides·savedRoutes·conquest(부모 문서가 없어 collection 조회로 안 보이는 chunks·traces
 * 포함)·members·livePublicationRides·routeTokenLedger·nicknames.ownerUid·
 * publicRouteRequests·routePublications.applicantUid·openTrailListings.hostUid(정책
 * delete — 02-task-12 §3)·RTDB motion 만 남은 데이터를 놓치지 않는다(accountDeletionCore
 * 개인귀속 정책과 대조 — 02-task-09 §3).
 * 반대로 공용 Trail 문서 자체의 hostUid(「trails/{id}」는 정책 none — 공용역사)는
 * 귀속 표시가 아니므로 여전히 후보로 넣지 않는다.
 *
 * 비용 한계(소규모 초기 단계 기준): Auth 전체 페이지 순회 + 컬렉션별 id·userId 단 필드
 * projection 스캔 1회 + group 스캔 4회(members·livePublicationRides·conquest
 * chunks·traces) + 후보 uid 1명당 users profile get 1건. 규모가 수만 Guest 로 늘어나면
 * projection·group 스캔의 커서 분산과 배치 cap(runGuestLifecycleSweep 삭제 20건/실행)
 * 재조정이 필요하다.
 * RTDB 재쓰기 차단은 guestLifecycle/{uid}/blocked 쓰기가 보장될 때만 삭제가 진행된다 —
 * RTDB 초기화 실패 시 guestRtdbPort 가 거부해 손실·재시도 상태로 남는다.
 */
import type { Auth, UserRecord } from "firebase-admin/auth";
import { getDatabase, type Database } from "firebase-admin/database";
import type { Firestore } from "firebase-admin/firestore";
import { deleteAccountData } from "./accountDeletionCore.js";
import {
  GUEST_INACTIVITY_MS,
  isWithinGuestWindow,
  parseProtectedUidList,
  unionCandidateUids,
  type AuthSnapshot,
  type DocData,
  type GuestAuthPort,
  type GuestDocStore,
  type GuestLifecyclePorts,
  type GuestRtdbPort,
} from "./guestLifecycleCore.js";

export function authSnapshotFromFields(input: {
  uid: string;
  email?: string | null;
  phoneNumber?: string | null;
  disabled: boolean;
  providerCount: number;
  customClaims?: Record<string, unknown> | null;
}): AuthSnapshot {
  const claims = input.customClaims ?? {};
  const admin = Object.keys(claims).some((key) => /admin/i.test(key) && claims[key] !== false && claims[key] != null);
  const anonymous = input.providerCount === 0 && !input.email && !input.phoneNumber;
  return {
    uid: input.uid,
    anonymous,
    disabled: input.disabled,
    admin,
    email: input.email ?? null,
  };
}

export function authSnapshotFromUserRecord(user: UserRecord): AuthSnapshot {
  return authSnapshotFromFields({
    uid: user.uid,
    email: user.email,
    phoneNumber: user.phoneNumber,
    disabled: user.disabled,
    providerCount: user.providerData.length,
    customClaims: (user.customClaims ?? null) as Record<string, unknown> | null,
  });
}

function millisOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function notFound(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "auth/user-not-found";
}

export function firestoreGuestStore(db: Firestore): GuestDocStore {
  return {
    get: async (path) => {
      const snap = await db.doc(path).get();
      return snap.exists ? (snap.data() as DocData) : null;
    },
    runTransaction: (fn) => db.runTransaction(async (tx) => fn({
      get: async (path) => {
        const snap = await tx.get(db.doc(path));
        return snap.exists ? (snap.data() as DocData) : null;
      },
      set: (path, data) => {
        tx.set(db.doc(path), data);
      },
    })),
  };
}

async function collectionIds(db: Firestore, name: string): Promise<string[]> {
  const snap = await db.collection(name).select().get();
  return snap.docs.map((doc) => doc.id);
}

/** 컬렉션 전체를 userId 필드 projection 으로 훑어 uid 후보를 모은다. rides·savedRoutes 용. */
async function uidFieldValues(db: Firestore, name: string, field: string): Promise<string[]> {
  const snap = await db.collection(name).select(field).get();
  const out: string[] = [];
  for (const doc of snap.docs) {
    const value = doc.get(field);
    if (typeof value === "string" && value.length > 0 && value.length <= 128) out.push(value);
  }
  return out;
}

/**
 * 경로 검증 group 스캔 — 문서 id·필드가 아니라 **문서 경로**로 개인 귀속을 확인한다.
 * "members"·"chunks"·"traces" 를 쓴 하위 컬렉션은 여러 곳에 존재할 수 있으므로
 * accountDeletionCore 개인귀속 경로와 일치하는 문서만 후보로 만든다.
 * Firestore 는 부모 문서가 없어도 하위 컬렉션을 읽을 수 있으므로 이 방식으로
 * users·conquest 요약이 이미 사라진 고아(conquest/{uid}/chunks·traces 만 남은 상태)도 발견한다.
 */

/** `conquest/{uid}/chunks|traces/...` 형태만 근거로 삼는다. */
export function conquestOrphanUidFromDocPath(docPath: string): string | null {
  const parts = docPath.split("/");
  if (parts.length < 4) return null;
  const [root, uid, sub] = parts;
  if (root !== "conquest" || (sub !== "chunks" && sub !== "traces")) return null;
  if (!uid || uid.length > 128) return null;
  return uid;
}

/** `trails/{id}/members/{uid}`·`publicationSessions/{id}/members/{uid}`·`trails/{id}/livePublicationRides/{uid}` 만. */
export function membershipUidFromDocPath(docPath: string): string | null {
  const parts = docPath.split("/");
  if (parts.length < 4) return null;
  const root = parts[0];
  const sub = parts[2];
  if (root !== "trails" && root !== "publicationSessions") return null;
  if (sub !== "members" && sub !== "livePublicationRides") return null;
  const uid = parts[3];
  if (!uid || uid.length > 128) return null;
  return uid;
}

/*
 * `openTrailListings/{docId}` 만 — ACCOUNT_DELETION_POLICY 에서 이 컬렉션은 최상위
 * "delete"(hostUid 귀속)이고 실제 정리(purgeGuestUsersCore.removeGuestUid...)도
 * db.collection("openTrailListings") 최상위만 지운다. 그러므로 같은 이름이라도
 * `X/{id}/openTrailListings/...` 형태의 subcollection 문자는 이 귀속의 근거가 아니다
 * (02-task-12 §3 — trails.hostUid 공용역사 제외 원칙과 같이, 허용 경로만 인정).
 */
export function isOpenTrailListingOwnershipPath(docPath: string): boolean {
  const parts = docPath.split("/");
  return parts.length === 2 && parts[0] === "openTrailListings" && !!parts[1];
}

/** openTrailListings hostUid 후보 — group 스캔에 경로 검증을 얹어 여러 곳에서 발견하는 trace·ledger와 같은 누락을 막는다. */
async function openTrailListingsHostUids(db: Firestore): Promise<string[]> {
  const snap = await db.collectionGroup("openTrailListings").select("hostUid").get();
  const survey: string[] = [];
  for (const doc of snap.docs) {
    if (!isOpenTrailListingOwnershipPath(doc.ref.path)) continue;
    const value = doc.get("hostUid");
    if (typeof value === "string" && value.length > 0 && value.length <= 128) survey.push(value);
  }
  return survey;
}

/**하위 문서들의 경로를 검증해 문서 id(=uid) 후보를 모은다 — member 류 공용/타컬렉션 혼입을 막는다. */
async function personalSubcollectionUids(db: Firestore, group: string): Promise<string[]> {
  const snap = await db.collectionGroup(group).select().get();
  const out: string[] = [];
  for (const doc of snap.docs) {
    const uid = membershipUidFromDocPath(doc.ref.path);
    if (uid) out.push(uid);
  }
  return out;
}



/** 부모 문서(conquest/{uid}) 없이 chunks·traces 만 남은 고아 후보. */
async function conquestOrphanSubcollectionUids(db: Firestore): Promise<string[]> {
  const [chunks, traces] = await Promise.all([
    db.collectionGroup("chunks").select().get(),
    db.collectionGroup("traces").select().get(),
  ]);
  const out: string[] = [];
  for (const doc of [...chunks.docs, ...traces.docs]) {
    const uid = conquestOrphanUidFromDocPath(doc.ref.path);
    if (uid) out.push(uid);
  }
  return out;
}

/** RTDB 클라이언트 재쓰기 차단. rtdb 초기화 실패 시 절대 조용히 통과하지 않는다. */
export function guestRtdbPort(rtdb: Database | null): GuestRtdbPort {
  return {
    setBlocked: async (uid, blocked) => {
      if (!rtdb) throw new Error("rtdb/unavailable: 차단 쓰기를 보장할 수 없어 계정 정리를 진행하지 않는다");
      await rtdb.ref(`guestLifecycle/${uid}/blocked`).set(blocked);
    },
  };
}

/** RTDB 초기화 — 실패는 null 이고 null 은 port 층에서 예외로 다룬다. */
export function getRtdbOrNull(): Database | null {
  try {
    return getDatabase();
  } catch {
    return null;
  }
}

/** trails 모션 노드만 남은 개인 데이터도 놓치지 않는다 — RTDB motion sweep 전용. */
export async function listRtdbMotionUids(rtdb: Database | null): Promise<string[]> {
  if (!rtdb) return [];
  const trails = await rtdb.ref("trails").get();
  const uids: string[] = [];
  trails.forEach((trail) => {
    trail.child("motion").forEach((node) => {
      if (node.key) uids.push(node.key);
    });
  });
  return uids;
}

const RETRY_STATUSES = ["deletionScheduled", "disabling", "deleting", "failed"] as const;

/** guestLifecycleRuns 집계 문서 보존 기간 — 매일 1건이 무한히 쌓이지 않게 한다. */
export const GUEST_RUN_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
/** 한 회차에서 묶어 지우는 과거 run 의 수 — 유지보수 비용 상한 */
export const GUEST_RUN_PRUNE_LIMIT = 50;

/**
 * members(공용 Trail·session)·livePublicationRides 의 하위 문서 id 가 uid 다. 한 번만 읽어
 * 재사용한다 — 회차당 그룹 스캔 1회. 실제 최근 활동 판정은 per-uid 문서의 lastSeenAt 이다.
 */
type MembershipRefs = {
  refsByUid: Map<string, Array<{ path: string }>>;
};

async function buildMembershipRefs(db: Firestore): Promise<MembershipRefs> {
  const [members, liveRides] = await Promise.all([
    db.collectionGroup("members").select().get(),
    db.collectionGroup("livePublicationRides").select().get(),
  ]);
  const refsByUid = new Map<string, Array<{ path: string }>>();
  const push = (uid: string, path: string) => {
    const arr = refsByUid.get(uid);
    if (arr) arr.push({ path });
    else refsByUid.set(uid, [{ path }]);
  };
  for (const doc of members.docs) {
    const uid = membershipUidFromDocPath(doc.ref.path);
    if (uid) push(uid, doc.ref.path);
  }
  for (const doc of liveRides.docs) {
    const uid = membershipUidFromDocPath(doc.ref.path);
    if (uid) push(uid, doc.ref.path);
  }
  return { refsByUid };
}

/** trails 하위 motion 노드 최초 패킷 시각(t) → uid별 최댓값. RTDB 모션 활동 인덱스. */
async function listLatestMotionMsByUid(rtdb: Database | null): Promise<Map<string, number>> {
  const latest = new Map<string, number>();
  if (!rtdb) return latest;
  const trails = await rtdb.ref("trails").get();
  trails.forEach((trail) => {
    trail.child("motion").forEach((node) => {
      const uid = node.key;
      const tMs = millisOf(node.child("t").val());
      if (!uid || tMs == null) return;
      const prev = latest.get(uid);
      if (prev == null || tMs > prev) latest.set(uid, tMs);
    });
  });
  return latest;
}

export async function guestLifecyclePortsFromAdmin(
  db: Firestore,
  auth: Auth,
  rtdb: Database | null,
  nowMs: number,
): Promise<GuestLifecyclePorts> {
  const protectedSnap = await db.doc("config/guestLifecycle").get();
  const protectedUids = new Set(parseProtectedUidList(protectedSnap.data() as Record<string, unknown> | undefined));
  const authPort: GuestAuthPort = {
    getUser: async (uid) => {
      try {
        return authSnapshotFromUserRecord(await auth.getUser(uid));
      } catch (error) {
        if (notFound(error)) return null;
        throw error;
      }
    },
    updateUser: async (uid, patch) => {
      await auth.updateUser(uid, patch);
    },
    deleteUser: async (uid) => {
      try {
        await auth.deleteUser(uid);
      } catch (error) {
        if (!notFound(error)) throw error;
      }
    },
  };
  const rtdbPort = guestRtdbPort(rtdb);
  /*
   * 회차당 최대 1회: membership·RTDB motion 인덱스는 pipeline 에 들어온 후보(활동 원장에
   * 없어 만료 배치에 노출된 uid)만 봐야 하므로 lazy 로 시작한다.
   */
  let membershipRefs: Promise<MembershipRefs> | null = null;
  const ensureMembershipRefs = () => {
    membershipRefs ??= buildMembershipRefs(db);
    return membershipRefs;
  };
  let motionMsByUid: Promise<Map<string, number>> | null = null;
  const ensureMotionMs = () => {
    motionMsByUid ??= listLatestMotionMsByUid(rtdb);
    return motionMsByUid;
  };
  return {
    nowMs,
    store: firestoreGuestStore(db),
    auth: authPort,
    rtdb: rtdbPort,
    protectedUids,
    listAuthUsers: async () => {
      const users: AuthSnapshot[] = [];
      let pageToken: string | undefined;
      do {
        const page = await auth.listUsers(1000, pageToken);
        for (const user of page.users) users.push(authSnapshotFromUserRecord(user));
        pageToken = page.pageToken;
      } while (pageToken);
      return users;
    },
    listProfileUids: async () => {
      const [
        userIds,
        privateIds,
        presenceIds,
        conquestIds,
        rideUids,
        savedRouteUids,
        routeCacheUids,
        ledgerUids,
        nicknameUids,
        routeRequestUids,
        routePublicationUids,
        memberUids,
        liveRideUids,
        conquestOrphanUids,
        listingHostUids,
        motionUids,
      ] = await Promise.all([
        collectionIds(db, "users"),
        collectionIds(db, "userPrivate"),
        collectionIds(db, "livePresence"),
        collectionIds(db, "conquest"),
        uidFieldValues(db, "rides", "userId"),
        uidFieldValues(db, "savedRoutes", "userId"),
        uidFieldValues(db, "routeAutoRouteCache", "userId"),
        // routeTokenLedger 문서 id 는 멱등키 해시라 uid 가 아니므로 userId 필드로 귀속을 찾는다.
        uidFieldValues(db, "routeTokenLedger", "userId"),
        // 닉네임 원장 ownerUid — users 문서 없이 남으면 이 scan 이 유일한 발견 근거가 된다.
        uidFieldValues(db, "nicknames", "ownerUid"),
        // 공개 신청 applicantUid — 개인귀속(삭제 대상) 요청문서.
        uidFieldValues(db, "publicRouteRequests", "applicantUid"),
        // 익명화 전 routePublications.applicantUid 도 개인귀속 표시다(정책: anonymize).
        uidFieldValues(db, "routePublications", "applicantUid"),
        personalSubcollectionUids(db, "members"),
        personalSubcollectionUids(db, "livePublicationRides"),
        conquestOrphanSubcollectionUids(db),
        openTrailListingsHostUids(db),
        listRtdbMotionUids(rtdb),
      ]);
      return unionCandidateUids(
        userIds,
        privateIds,
        presenceIds,
        conquestIds,
        rideUids,
        savedRouteUids,
        routeCacheUids,
        ledgerUids,
        nicknameUids,
        routeRequestUids,
        routePublicationUids,
        memberUids,
        liveRideUids,
        conquestOrphanUids,
        listingHostUids,
        motionUids,
      );
    },
    listRetryUids: async () => {
      const snap = await db.collection("guestLifecycle").where("status", "in", [...RETRY_STATUSES]).get();
      return snap.docs.map((doc) => doc.id);
    },
    readUserProfile: async (uid) => {
      const snap = await db.doc(`users/${uid}`).get();
      if (!snap.exists) return null;
      const tier = snap.get("tier");
      const isAnonymous = snap.get("isAnonymous");
      return {
        tier: typeof tier === "string" ? tier : null,
        isAnonymous: typeof isAnonymous === "boolean" ? isAnonymous : null,
      };
    },
    /*
     * 활동 판정 — rides·livePresence 뿐 아니라 동행 실역(Trail members·session members·
     * livePublicationRides lastSeenAt)과 RTDB motion t 도 본다. 공용 Trail 문서는 읽지 않는다.
     */
    recentRideOrPresence: async (uid, at) => {
      const [ride, presence] = await Promise.all([
        db.collection("rides").where("userId", "==", uid).orderBy("endedAt", "desc").limit(1).get(),
        db.doc(`livePresence/${uid}`).get(),
      ]);
      const endedMs = millisOf(ride.docs[0]?.get("endedAt"));
      const seenMs = millisOf(presence.get("updatedAt"));
      if (isWithinGuestWindow(endedMs, at, GUEST_INACTIVITY_MS) || isWithinGuestWindow(seenMs, at, GUEST_INACTIVITY_MS)) return true;
      const refs = (await ensureMembershipRefs()).refsByUid.get(uid) ?? [];
      const memberDocs = await Promise.all(refs.map((ref) => db.doc(ref.path).get()));
      for (const doc of memberDocs) {
        if (isWithinGuestWindow(millisOf(doc.get("lastSeenAt")), at, GUEST_INACTIVITY_MS)) return true;
      }
      const motionMs = (await ensureMotionMs()).get(uid) ?? null;
      return isWithinGuestWindow(motionMs, at, GUEST_INACTIVITY_MS);
    },
    deleteAccountData: async (uid) => {
      await deleteAccountData(db, rtdb, uid);
    },
    recordRun: async (report) => {
      // 무한 누적 방지 — 매 회차 90일 지난 run 50건(상한)까지 묶어 지운다.
      const runs = db.collection("guestLifecycleRuns");
      await runs.add({ ...report, createdAtMs: nowMs });
      const stale = await runs.where("createdAtMs", "<", nowMs - GUEST_RUN_RETENTION_MS).limit(GUEST_RUN_PRUNE_LIMIT).get();
      if (stale.empty) return;
      const batch = db.batch();
      for (const doc of stale.docs) batch.delete(doc.ref);
      await batch.commit();
    },
  };
}
