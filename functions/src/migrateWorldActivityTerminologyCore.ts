import { FieldValue, getFirestore } from "firebase-admin/firestore";

const WORLD_ACTIVITY = "worldActivity";
const GLOBAL_ID = "global";

function stringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
}

export type MigrateWorldActivityTerminologyResult = {
  dryRun: boolean;
  found: boolean;
  migrated: boolean;
  patch: {
    highlightedPublications: number;
    activePublicationCount: number | null;
    removedLegacyFields: string[];
  };
};

/**
 * `worldActivity/global` — `highlightedCourses` → `highlightedPublications`,
 * `activeCourseCount` → `activePublicationCount`, 레거시 필드 delete.
 */
export async function migrateWorldActivityTerminologyWithAdminSdk(input: {
  dryRun: boolean;
}): Promise<MigrateWorldActivityTerminologyResult> {
  const db = getFirestore();
  const ref = db.doc(`${WORLD_ACTIVITY}/${GLOBAL_ID}`);
  const snap = await ref.get();

  const empty: MigrateWorldActivityTerminologyResult = {
    dryRun: input.dryRun,
    found: false,
    migrated: false,
    patch: { highlightedPublications: 0, activePublicationCount: null, removedLegacyFields: [] },
  };

  if (!snap.exists) return empty;

  const data = snap.data() as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  const removedLegacyFields: string[] = [];

  const highlightedCourses = stringArray(data.highlightedCourses);
  const highlightedPublications = stringArray(data.highlightedPublications);
  const nextHighlighted =
    highlightedPublications.length > 0 ? highlightedPublications : highlightedCourses;

  if (nextHighlighted.length > 0 && highlightedPublications.length === 0) {
    patch.highlightedPublications = nextHighlighted;
  }

  const activeCourseCount =
    typeof data.activeCourseCount === "number" && Number.isFinite(data.activeCourseCount)
      ? Math.max(0, Math.floor(data.activeCourseCount))
      : null;
  const activePublicationCount =
    typeof data.activePublicationCount === "number" && Number.isFinite(data.activePublicationCount)
      ? Math.max(0, Math.floor(data.activePublicationCount))
      : null;

  if (activePublicationCount == null && activeCourseCount != null) {
    patch.activePublicationCount = activeCourseCount;
  }

  const willHaveHighlighted =
    highlightedPublications.length > 0 || patch.highlightedPublications != null;
  if (data.highlightedCourses != null && willHaveHighlighted) {
    patch.highlightedCourses = FieldValue.delete();
    removedLegacyFields.push("highlightedCourses");
  }

  const willHaveActiveCount =
    activePublicationCount != null || patch.activePublicationCount != null;
  if (data.activeCourseCount != null && willHaveActiveCount) {
    patch.activeCourseCount = FieldValue.delete();
    removedLegacyFields.push("activeCourseCount");
  }

  if (Object.keys(patch).length === 0) {
    return {
      dryRun: input.dryRun,
      found: true,
      migrated: false,
      patch: {
        highlightedPublications: nextHighlighted.length,
        activePublicationCount: activePublicationCount ?? activeCourseCount,
        removedLegacyFields: [],
      },
    };
  }

  if (!input.dryRun) {
    await ref.set(patch, { merge: true });
  }

  return {
    dryRun: input.dryRun,
    found: true,
    migrated: true,
    patch: {
      highlightedPublications: nextHighlighted.length,
      activePublicationCount:
        (typeof patch.activePublicationCount === "number"
          ? patch.activePublicationCount
          : null) ??
        activePublicationCount ??
        activeCourseCount,
      removedLegacyFields,
    },
  };
}
