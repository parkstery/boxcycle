import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import {
  LEGACY_COURSE_ACTIVITY_COLLECTION,
  LEGACY_COURSE_PRESENCE_COLLECTION,
  LEGACY_COURSES_COLLECTION,
  LEGACY_LIVE_COURSE_RIDES_SUBCOLLECTION,
  LIVE_ROUTE_RIDES_SUBCOLLECTION,
  ROUTE_ACTIVITY_COLLECTION,
  ROUTE_CATALOG_COLLECTION,
  ROUTE_PRESENCE_COLLECTION,
  ROUTE_PRESENCE_MEMBERS_SUBCOLLECTION,
  TRAILS_COLLECTION,
} from "./firestoreCollections.js";

export type MigrateRouteCatalogPathsResult = {
  routeCatalogCopied: number;
  routeCatalogSkipped: number;
  routeActivityCopied: number;
  routeActivitySkipped: number;
  routePresenceMembersCopied: number;
  routePresenceMembersSkipped: number;
  liveRouteRidesCopied: number;
  liveRouteRidesSkipped: number;
  dryRun: boolean;
};

function isTrailOrRoomLivePath(path: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 4) return false;
  const root = parts[0];
  const sub = parts[2];
  return (root === TRAILS_COLLECTION || root === "rooms") && sub === LEGACY_LIVE_COURSE_RIDES_SUBCOLLECTION;
}

function liveSourceToTargetRef(source: DocumentReference): DocumentReference {
  const parts = source.path.split("/");
  const trailId = parts[1];
  const uid = parts[3];
  return getFirestore()
    .collection(TRAILS_COLLECTION)
    .doc(trailId)
    .collection(LIVE_ROUTE_RIDES_SUBCOLLECTION)
    .doc(uid);
}

async function copyDoc(
  source: DocumentReference,
  target: DocumentReference,
  dryRun: boolean,
): Promise<"copied" | "skipped"> {
  const exists = (await target.get()).exists;
  if (exists) return "skipped";
  if (!dryRun) {
    const snap = await source.get();
    if (!snap.exists) return "skipped";
    await target.set(snap.data() ?? {}, { merge: true });
  }
  return "copied";
}

/**
 * P4 — `courses`·`courseActivity`·`coursePresence`·`liveCourseRides` → Route 경로로 복사(동일 문서 ID).
 * 소스 컬렉션은 삭제하지 않는다.
 */
export async function migrateRouteCatalogPathsWithAdminSdk(opts: {
  dryRun?: boolean;
}): Promise<MigrateRouteCatalogPathsResult> {
  const dryRun = opts.dryRun === true;
  const db = getFirestore();
  const result: MigrateRouteCatalogPathsResult = {
    routeCatalogCopied: 0,
    routeCatalogSkipped: 0,
    routeActivityCopied: 0,
    routeActivitySkipped: 0,
    routePresenceMembersCopied: 0,
    routePresenceMembersSkipped: 0,
    liveRouteRidesCopied: 0,
    liveRouteRidesSkipped: 0,
    dryRun,
  };

  const coursesSnap = await db.collection(LEGACY_COURSES_COLLECTION).get();
  for (const doc of coursesSnap.docs) {
    const target = db.collection(ROUTE_CATALOG_COLLECTION).doc(doc.id);
    const status = await copyDoc(doc.ref, target, dryRun);
    if (status === "copied") result.routeCatalogCopied += 1;
    else result.routeCatalogSkipped += 1;
  }

  const activitySnap = await db.collection(LEGACY_COURSE_ACTIVITY_COLLECTION).get();
  for (const doc of activitySnap.docs) {
    const target = db.collection(ROUTE_ACTIVITY_COLLECTION).doc(doc.id);
    const status = await copyDoc(doc.ref, target, dryRun);
    if (status === "copied") result.routeActivityCopied += 1;
    else result.routeActivitySkipped += 1;
  }

  const presenceRoots = await db.collection(LEGACY_COURSE_PRESENCE_COLLECTION).listDocuments();
  for (const routeIdRef of presenceRoots) {
    const routeId = routeIdRef.id;
    const membersSnap = await db
      .collection(LEGACY_COURSE_PRESENCE_COLLECTION)
      .doc(routeId)
      .collection(ROUTE_PRESENCE_MEMBERS_SUBCOLLECTION)
      .get();
    for (const member of membersSnap.docs) {
      const target = db
        .collection(ROUTE_PRESENCE_COLLECTION)
        .doc(routeId)
        .collection(ROUTE_PRESENCE_MEMBERS_SUBCOLLECTION)
        .doc(member.id);
      const status = await copyDoc(member.ref, target, dryRun);
      if (status === "copied") result.routePresenceMembersCopied += 1;
      else result.routePresenceMembersSkipped += 1;
    }
  }

  const liveSnap = await db.collectionGroup(LEGACY_LIVE_COURSE_RIDES_SUBCOLLECTION).get();
  for (const doc of liveSnap.docs) {
    if (!isTrailOrRoomLivePath(doc.ref.path)) continue;
    const target = liveSourceToTargetRef(doc.ref);
    const status = await copyDoc(doc.ref, target, dryRun);
    if (status === "copied") result.liveRouteRidesCopied += 1;
    else result.liveRouteRidesSkipped += 1;
  }

  return result;
}
