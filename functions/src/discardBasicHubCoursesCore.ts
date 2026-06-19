import { FieldValue, getFirestore } from "firebase-admin/firestore";

/** 폐기 대상 — 이후 새 ID로 재생성 예정 */
export const DISCARDED_BASIC_HUB_COURSE_IDS = [
  "basic-alps-grindelwald-5km",
  "basic-iceland-ring-road-5km",
] as const;

export type DiscardBasicHubCoursesResult = {
  dryRun: boolean;
  courseIds: readonly string[];
  archived: number;
  activityDeleted: number;
  presenceDeleted: number;
  errors: number;
};

export async function discardBasicHubCoursesWithAdminSdk(input: {
  dryRun: boolean;
}): Promise<DiscardBasicHubCoursesResult> {
  const db = getFirestore();
  const result: DiscardBasicHubCoursesResult = {
    dryRun: input.dryRun,
    courseIds: DISCARDED_BASIC_HUB_COURSE_IDS,
    archived: 0,
    activityDeleted: 0,
    presenceDeleted: 0,
    errors: 0,
  };

  for (const courseId of DISCARDED_BASIC_HUB_COURSE_IDS) {
    try {
      const courseRef = db.doc(`courses/${courseId}`);
      const courseSnap = await courseRef.get();
      if (courseSnap.exists) {
        if (!input.dryRun) {
          await courseRef.set(
            {
              status: "archived",
              isSharedStartHub: false,
              presenceEnabled: false,
              archivedReason: "deprecated_basic_hub_v1",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
        result.archived += 1;
      }

      const activityRef = db.doc(`routeActivity/${courseId}`);
      const activitySnap = await activityRef.get();
      if (activitySnap.exists) {
        if (!input.dryRun) await activityRef.delete();
        result.activityDeleted += 1;
      }

      const presenceRef = db.doc(`publicationPresence/${courseId}`);
      const presenceSnap = await presenceRef.get();
      if (presenceSnap.exists) {
        if (!input.dryRun) await presenceRef.delete();
        result.presenceDeleted += 1;
      }
    } catch (e) {
      console.error("[discardBasicHubCourses]", courseId, e);
      result.errors += 1;
    }
  }

  return result;
}
