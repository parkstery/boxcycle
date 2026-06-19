import { getFirestore } from "firebase-admin/firestore";
import {
  TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION,
  TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION,
  TRAILS_COLLECTION,
} from "./trailPaths.js";

export type MigrateLivePublicationRidesResult = {
  dryRun: boolean;
  scanned: number;
  copied: number;
  skippedExisting: number;
  deletedLegacy: number;
  errors: number;
};

/**
 * `trails/{id}/liveCourseRides` → `livePublicationRides` 복사.
 * `courseId` → `publicationId` 필드 rename. 대상이 있으면 skip.
 */
export async function migrateLivePublicationRidesWithAdminSdk(input: {
  dryRun: boolean;
  deleteLegacy?: boolean;
}): Promise<MigrateLivePublicationRidesResult> {
  const db = getFirestore();
  const result: MigrateLivePublicationRidesResult = {
    dryRun: input.dryRun,
    scanned: 0,
    copied: 0,
    skippedExisting: 0,
    deletedLegacy: 0,
    errors: 0,
  };

  const legacySnap = await db.collectionGroup(TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION).get();
  for (const doc of legacySnap.docs) {
    result.scanned += 1;
    const trailId = doc.ref.parent.parent?.id;
    if (!trailId) continue;

    const targetRef = db
      .collection(TRAILS_COLLECTION)
      .doc(trailId)
      .collection(TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION)
      .doc(doc.id);

    try {
      const existing = await targetRef.get();
      if (existing.exists) {
        result.skippedExisting += 1;
      } else {
        const data = doc.data() as Record<string, unknown>;
        const publicationId =
          (typeof data.publicationId === "string" && data.publicationId.trim()) ||
          (typeof data.courseId === "string" && data.courseId.trim()) ||
          "";
        if (!publicationId) {
          result.errors += 1;
          continue;
        }
        const payload: Record<string, unknown> = {
          publicationId,
          progressRatio: data.progressRatio,
          lastSeenAt: data.lastSeenAt,
        };
        if (typeof data.displayName === "string") payload.displayName = data.displayName;
        if (!input.dryRun) {
          await targetRef.set(payload, { merge: true });
        }
        result.copied += 1;
      }

      if (input.deleteLegacy && !input.dryRun) {
        await doc.ref.delete();
        result.deletedLegacy += 1;
      }
    } catch (e) {
      console.error("[migrateLivePublicationRides]", doc.ref.path, e);
      result.errors += 1;
    }
  }

  return result;
}
