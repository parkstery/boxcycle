/**
 * 익명(Guest) Firebase Auth 계정 + 그 uid 로 귀속되는 Firestore 데이터 일괄 삭제.
 *
 * 익명 판정: providerData.length === 0 && !email && !phoneNumber.
 * custom claims 에 admin 류가 있으면(예: claims.admin === true) 무조건 제외한다.
 *
 * 삭제 대상 컬렉션(uid 귀속 확정분, firestore.rules · 각 core 모듈 소스로 확인):
 *   - users/{uid}
 *   - conquest/{uid} (+ chunks/*, traces/*)
 *   - rides            where userId == uid
 *   - savedRoutes      where userId == uid
 *   - routeTokenLedger where userId == uid   (문서 id 는 idempotencyKey 해시 — uid 아님)
 *   - livePresence/{uid}
 *   - openTrailListings where hostUid == uid  (Trailhead 목록 항목 — ephemeral)
 *   - trails/{trailId}/members/{uid}                     (collection group "members")
 *   - publicationSessions/{publicationId}/members/{uid}  (collection group "members", 위와 동명)
 *   - trails/{trailId}/livePublicationRides/{uid}         (collection group)
 *   - publicRouteRequests where applicantUid == uid
 *
 * 삭제 대상에서 제외(보고만):
 *   - routePublications — 공개 경로. 익명은 rules(userTierAllowsPublicRoute)상 애초에 만들 수
 *     없지만, savedRoutes(userId==uid) → routeId 로 역참조되는 문서가 있는지 확인해 개수만 보고한다.
 *     실제로 있다면 다른 사용자 화면(공개 경로 목록)에 영향이 가므로 감리 판단 필요.
 *   - trails/{trailId} 문서 자체(hostUid==uid) — 다른 참가자의 members 서브컬렉션이 그 trailId 를
 *     참조하고 있어 문서를 지우면 고아 참조가 생긴다. 개수만 보고.
 *   - publicationPresence/{publicationId} — publicationId 로 집계되는 문서라 uid 귀속이 아니다.
 */
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type UserRecord } from "firebase-admin/auth";

const BATCH_LIMIT = 500;
const IN_CHUNK = 10;

export type GuestCandidate = {
  uid: string;
  createdAt: string;
  lastSignInAt: string;
};

export type ExcludedAdminUser = {
  uid: string;
  reason: string;
};

export type ListGuestCandidatesResult = {
  scannedAuthUsers: number;
  candidates: GuestCandidate[];
  excludedAdminClaims: ExcludedAdminUser[];
};

/** Auth 전체를 페이지네이션으로 순회 → 익명 사용자만 추린다. admin류 custom claims 는 제외. */
export async function listGuestCandidates(): Promise<ListGuestCandidatesResult> {
  const auth = getAuth();
  const candidates: GuestCandidate[] = [];
  const excludedAdminClaims: ExcludedAdminUser[] = [];
  let scannedAuthUsers = 0;
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      scannedAuthUsers += 1;
      if (!isAnonymousUserRecord(user)) continue;
      const claims = (user.customClaims ?? {}) as Record<string, unknown>;
      const adminClaimKey = Object.keys(claims).find(
        (k) => /admin/i.test(k) && claims[k] !== false && claims[k] != null,
      );
      if (adminClaimKey) {
        excludedAdminClaims.push({ uid: user.uid, reason: `customClaims.${adminClaimKey}=${String(claims[adminClaimKey])}` });
        continue;
      }
      candidates.push({
        uid: user.uid,
        createdAt: user.metadata.creationTime,
        lastSignInAt: user.metadata.lastSignInTime,
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return { scannedAuthUsers, candidates, excludedAdminClaims };
}

export function isAnonymousUserRecord(user: UserRecord): boolean {
  return user.providerData.length === 0 && !user.email && !user.phoneNumber;
}

export type GuestDataCounts = {
  uid: string;
  users: number;
  conquestSummary: number;
  conquestChunks: number;
  conquestTraces: number;
  rides: number;
  savedRoutes: number;
  routeTokenLedger: number;
  livePresence: number;
  openTrailListings: number;
  trailMembers: number;
  publicationSessionMembers: number;
  livePublicationRides: number;
  publicRouteRequests: number;
  /** 보고 전용 — 삭제하지 않음 */
  routePublicationsOwnedReportOnly: number;
  /** 보고 전용 — 삭제하지 않음 */
  trailsHostedReportOnly: number;
};

function emptyCounts(uid: string): GuestDataCounts {
  return {
    uid,
    users: 0,
    conquestSummary: 0,
    conquestChunks: 0,
    conquestTraces: 0,
    rides: 0,
    savedRoutes: 0,
    routeTokenLedger: 0,
    livePresence: 0,
    openTrailListings: 0,
    trailMembers: 0,
    publicationSessionMembers: 0,
    livePublicationRides: 0,
    publicRouteRequests: 0,
    routePublicationsOwnedReportOnly: 0,
    trailsHostedReportOnly: 0,
  };
}

/**
 * `trails/*\/members`·`publicationSessions/*\/members`·`trails/*\/livePublicationRides` 는
 * 문서 id == uid 로 저장된다. uid 별로 매번 collection group 을 훑으면 guest 수만큼 반복 스캔이
 * 되므로, 한 번 스캔해 uid → ref[] 맵을 만들어 재사용한다.
 */
export type PresenceIndex = {
  trailMembersByUid: Map<string, FirebaseFirestore.DocumentReference[]>;
  publicationSessionMembersByUid: Map<string, FirebaseFirestore.DocumentReference[]>;
  livePublicationRidesByUid: Map<string, FirebaseFirestore.DocumentReference[]>;
  openTrailListingsByHostUid: Map<string, FirebaseFirestore.DocumentReference[]>;
  trailsByHostUid: Map<string, FirebaseFirestore.DocumentReference[]>;
};

function pushInto(map: Map<string, FirebaseFirestore.DocumentReference[]>, key: string, ref: FirebaseFirestore.DocumentReference): void {
  const arr = map.get(key);
  if (arr) arr.push(ref);
  else map.set(key, [ref]);
}

export async function buildPresenceIndex(db: Firestore): Promise<PresenceIndex> {
  const trailMembersByUid = new Map<string, FirebaseFirestore.DocumentReference[]>();
  const publicationSessionMembersByUid = new Map<string, FirebaseFirestore.DocumentReference[]>();
  const livePublicationRidesByUid = new Map<string, FirebaseFirestore.DocumentReference[]>();
  const openTrailListingsByHostUid = new Map<string, FirebaseFirestore.DocumentReference[]>();
  const trailsByHostUid = new Map<string, FirebaseFirestore.DocumentReference[]>();

  // "members" 는 trails/{id}/members 와 publicationSessions/{id}/members 가 동명이라
  // collectionGroup 하나에 둘 다 섞여 나온다 — 부모 컬렉션 이름으로 구분한다.
  const membersSnap = await db.collectionGroup("members").get();
  for (const doc of membersSnap.docs) {
    const uid = doc.id;
    const parentCollection = doc.ref.parent; // trails/{id}/members 또는 publicationSessions/{id}/members
    const grandparent = parentCollection.parent; // trails/{id} 또는 publicationSessions/{id}
    const rootCollectionId = grandparent?.parent?.id; // "trails" 또는 "publicationSessions"
    if (rootCollectionId === "trails") {
      pushInto(trailMembersByUid, uid, doc.ref);
    } else if (rootCollectionId === "publicationSessions") {
      pushInto(publicationSessionMembersByUid, uid, doc.ref);
    }
  }

  const liveRidesSnap = await db.collectionGroup("livePublicationRides").get();
  for (const doc of liveRidesSnap.docs) {
    pushInto(livePublicationRidesByUid, doc.id, doc.ref);
  }

  const openListingsSnap = await db.collection("openTrailListings").get();
  for (const doc of openListingsSnap.docs) {
    const hostUid = doc.get("hostUid");
    if (typeof hostUid === "string" && hostUid) pushInto(openTrailListingsByHostUid, hostUid, doc.ref);
  }

  const trailsSnap = await db.collection("trails").get();
  for (const doc of trailsSnap.docs) {
    const hostUid = doc.get("hostUid");
    if (typeof hostUid === "string" && hostUid) pushInto(trailsByHostUid, hostUid, doc.ref);
  }

  return { trailMembersByUid, publicationSessionMembersByUid, livePublicationRidesByUid, openTrailListingsByHostUid, trailsByHostUid };
}

async function countWhere(db: Firestore, collection: string, field: string, uid: string): Promise<number> {
  const snap = await db.collection(collection).where(field, "==", uid).count().get();
  return snap.data().count;
}

export async function countGuestUidData(db: Firestore, uid: string, presence: PresenceIndex): Promise<GuestDataCounts> {
  const counts = emptyCounts(uid);

  const [userSnap, conquestSnap, chunksSnap, tracesSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`conquest/${uid}`).get(),
    db.collection(`conquest/${uid}/chunks`).count().get(),
    db.collection(`conquest/${uid}/traces`).count().get(),
  ]);
  counts.users = userSnap.exists ? 1 : 0;
  counts.conquestSummary = conquestSnap.exists ? 1 : 0;
  counts.conquestChunks = chunksSnap.data().count;
  counts.conquestTraces = tracesSnap.data().count;

  const [rides, savedRoutes, ledger, publicRouteRequests] = await Promise.all([
    countWhere(db, "rides", "userId", uid),
    countWhere(db, "savedRoutes", "userId", uid),
    countWhere(db, "routeTokenLedger", "userId", uid),
    countWhere(db, "publicRouteRequests", "applicantUid", uid),
  ]);
  counts.rides = rides;
  counts.savedRoutes = savedRoutes;
  counts.routeTokenLedger = ledger;
  counts.publicRouteRequests = publicRouteRequests;

  const livePresenceSnap = await db.doc(`livePresence/${uid}`).get();
  counts.livePresence = livePresenceSnap.exists ? 1 : 0;

  counts.openTrailListings = presence.openTrailListingsByHostUid.get(uid)?.length ?? 0;
  counts.trailMembers = presence.trailMembersByUid.get(uid)?.length ?? 0;
  counts.publicationSessionMembers = presence.publicationSessionMembersByUid.get(uid)?.length ?? 0;
  counts.livePublicationRides = presence.livePublicationRidesByUid.get(uid)?.length ?? 0;
  counts.trailsHostedReportOnly = presence.trailsByHostUid.get(uid)?.length ?? 0;

  counts.routePublicationsOwnedReportOnly = await countOwnedRoutePublications(db, uid);

  return counts;
}

/** savedRoutes(userId==uid) → routeId 로 routePublications 를 역참조. 삭제하지 않고 개수만 센다. */
async function countOwnedRoutePublications(db: Firestore, uid: string): Promise<number> {
  const savedSnap = await db.collection("savedRoutes").where("userId", "==", uid).get();
  const routeIds = savedSnap.docs.map((d) => d.id);
  if (routeIds.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < routeIds.length; i += IN_CHUNK) {
    const chunk = routeIds.slice(i, i + IN_CHUNK);
    const snap = await db.collection("routePublications").where("routeId", "in", chunk).count().get();
    total += snap.data().count;
  }
  return total;
}

export type DeleteGuestUidResult = {
  uid: string;
  authDeleted: boolean;
  firestoreDocsDeleted: number;
  error?: string;
};

async function deleteRefsBatched(db: Firestore, refs: FirebaseFirestore.DocumentReference[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const chunk = refs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

async function collectRefsWhere(db: Firestore, collection: string, field: string, uid: string): Promise<FirebaseFirestore.DocumentReference[]> {
  const snap = await db.collection(collection).where(field, "==", uid).get();
  return snap.docs.map((d) => d.ref);
}

/** uid 하나의 Firestore 귀속 데이터를 전부 지운다. routePublications·trails 문서는 절대 건드리지 않는다. */
export async function deleteGuestUidFirestoreData(
  db: Firestore,
  uid: string,
  presence: PresenceIndex,
): Promise<number> {
  const refs: FirebaseFirestore.DocumentReference[] = [];

  refs.push(db.doc(`users/${uid}`));
  refs.push(db.doc(`conquest/${uid}`));
  refs.push(db.doc(`livePresence/${uid}`));

  const [chunksSnap, tracesSnap, rideRefs, savedRouteRefs, ledgerRefs, requestRefs] = await Promise.all([
    db.collection(`conquest/${uid}/chunks`).get(),
    db.collection(`conquest/${uid}/traces`).get(),
    collectRefsWhere(db, "rides", "userId", uid),
    collectRefsWhere(db, "savedRoutes", "userId", uid),
    collectRefsWhere(db, "routeTokenLedger", "userId", uid),
    collectRefsWhere(db, "publicRouteRequests", "applicantUid", uid),
  ]);
  for (const d of chunksSnap.docs) refs.push(d.ref);
  for (const d of tracesSnap.docs) refs.push(d.ref);
  refs.push(...rideRefs, ...savedRouteRefs, ...ledgerRefs, ...requestRefs);

  refs.push(...(presence.openTrailListingsByHostUid.get(uid) ?? []));
  refs.push(...(presence.trailMembersByUid.get(uid) ?? []));
  refs.push(...(presence.publicationSessionMembersByUid.get(uid) ?? []));
  refs.push(...(presence.livePublicationRidesByUid.get(uid) ?? []));

  // users/{uid} 문서가 애초에 없을 수도 있음(익명 최초 세션 등) — batch.delete 는 존재 여부와 무관하게 성공한다.
  return deleteRefsBatched(db, refs);
}

export async function deleteGuestAuthUser(auth: ReturnType<typeof getAuth>, uid: string): Promise<void> {
  await auth.deleteUser(uid);
}

export function firestoreForGuestPurge(): Firestore {
  return getFirestore();
}
