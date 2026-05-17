import { getFirestore, type DocumentReference } from "firebase-admin/firestore";

export type MigrateRoomsToTrailsResult = {
  membersCopied: number;
  liveCourseRidesCopied: number;
  membersSkipped: number;
  liveCourseRidesSkipped: number;
  dryRun: boolean;
};

function isRoomsMembersPath(path: string): boolean {
  const parts = path.split("/");
  return parts.length === 4 && parts[0] === "rooms" && parts[2] === "members";
}

function isRoomsLiveCourseRidesPath(path: string): boolean {
  const parts = path.split("/");
  return parts.length === 4 && parts[0] === "rooms" && parts[2] === "liveCourseRides";
}

function roomsToTrailsRef(source: DocumentReference): DocumentReference {
  const parts = source.path.split("/");
  const trailId = parts[1];
  const sub = parts[2];
  const docId = parts[3];
  return getFirestore().collection("trails").doc(trailId).collection(sub).doc(docId);
}

/**
 * `rooms/{trailId}/members|liveCourseRides` → `trails/{trailId}/...` 복사.
 * `coursePresence/.../members` 등 다른 collectionGroup 은 경로로 제외한다.
 */
export async function migrateRoomsToTrailsWithAdminSdk(opts: {
  dryRun?: boolean;
}): Promise<MigrateRoomsToTrailsResult> {
  const dryRun = opts.dryRun === true;
  const db = getFirestore();
  const result: MigrateRoomsToTrailsResult = {
    membersCopied: 0,
    liveCourseRidesCopied: 0,
    membersSkipped: 0,
    liveCourseRidesSkipped: 0,
    dryRun,
  };

  const membersSnap = await db.collectionGroup("members").get();
  for (const doc of membersSnap.docs) {
    if (!isRoomsMembersPath(doc.ref.path)) continue;
    const target = roomsToTrailsRef(doc.ref);
    const exists = (await target.get()).exists;
    if (exists) {
      result.membersSkipped += 1;
      continue;
    }
    if (!dryRun) {
      await target.set(doc.data(), { merge: true });
    }
    result.membersCopied += 1;
  }

  const liveSnap = await db.collectionGroup("liveCourseRides").get();
  for (const doc of liveSnap.docs) {
    if (!isRoomsLiveCourseRidesPath(doc.ref.path)) continue;
    const target = roomsToTrailsRef(doc.ref);
    const exists = (await target.get()).exists;
    if (exists) {
      result.liveCourseRidesSkipped += 1;
      continue;
    }
    if (!dryRun) {
      await target.set(doc.data(), { merge: true });
    }
    result.liveCourseRidesCopied += 1;
  }

  return result;
}
