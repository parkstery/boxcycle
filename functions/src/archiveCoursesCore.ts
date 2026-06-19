import { FieldValue, getFirestore } from "firebase-admin/firestore";

export type ArchiveCoursesResult = {
  dryRun: boolean;
  scanned: number;
  archived: number;
  skippedNoPublication: number;
  skippedAlreadyArchived: number;
  errors: number;
};

/**
 * `routePublications` 가 있는 `courses` 문서를 `status: archived` 로 표시.
 * Phase 5 — 런타임 카탈로그는 publications 단일.
 */
export async function archiveCoursesWithAdminSdk(input: {
  dryRun: boolean;
  limit?: number;
}): Promise<ArchiveCoursesResult> {
  const db = getFirestore();
  const cap = Math.min(500, Math.max(1, input.limit ?? 200));
  const result: ArchiveCoursesResult = {
    dryRun: input.dryRun,
    scanned: 0,
    archived: 0,
    skippedNoPublication: 0,
    skippedAlreadyArchived: 0,
    errors: 0,
  };

  const snap = await db.collection("courses").limit(cap).get();
  for (const doc of snap.docs) {
    result.scanned += 1;
    try {
      const data = doc.data();
      if (data.status === "archived") {
        result.skippedAlreadyArchived += 1;
        continue;
      }
      const pubSnap = await db.doc(`routePublications/${doc.id}`).get();
      if (!pubSnap.exists) {
        result.skippedNoPublication += 1;
        continue;
      }
      if (!input.dryRun) {
        await doc.ref.set(
          {
            status: "archived",
            archivedReason: "phase5_publications_only",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      result.archived += 1;
    } catch (e) {
      console.error("[archiveCourses]", doc.id, e);
      result.errors += 1;
    }
  }

  return result;
}
