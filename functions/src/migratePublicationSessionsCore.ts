import { getFirestore } from "firebase-admin/firestore";

const LEGACY_ROOT = "coursePresence";
const TARGET_ROOT = "publicationSessions";
const MEMBERS_SUB = "members";

export type MigratePublicationSessionsResult = {
  dryRun: boolean;
  scanned: number;
  copied: number;
  skippedExisting: number;
  deletedLegacy: number;
  errors: number;
};

/**
 * `coursePresence/{publicationId}/members/*` → `publicationSessions/{publicationId}/members/*`
 */
export async function migratePublicationSessionsWithAdminSdk(input: {
  dryRun: boolean;
  deleteLegacy?: boolean;
}): Promise<MigratePublicationSessionsResult> {
  const db = getFirestore();
  const result: MigratePublicationSessionsResult = {
    dryRun: input.dryRun,
    scanned: 0,
    copied: 0,
    skippedExisting: 0,
    deletedLegacy: 0,
    errors: 0,
  };

  const legacySnap = await db.collectionGroup(MEMBERS_SUB).get();
  for (const doc of legacySnap.docs) {
    const parts = doc.ref.path.split("/");
    if (parts.length !== 4 || parts[0] !== LEGACY_ROOT || parts[2] !== MEMBERS_SUB) continue;
    const publicationId = parts[1];

    result.scanned += 1;
    const targetRef = db
      .collection(TARGET_ROOT)
      .doc(publicationId)
      .collection(MEMBERS_SUB)
      .doc(doc.id);

    try {
      const existing = await targetRef.get();
      if (existing.exists) {
        result.skippedExisting += 1;
      } else {
        if (!input.dryRun) {
          await targetRef.set(doc.data(), { merge: true });
        }
        result.copied += 1;
      }

      if (input.deleteLegacy && !input.dryRun) {
        await doc.ref.delete();
        result.deletedLegacy += 1;
      }
    } catch (e) {
      console.error("[migratePublicationSessions]", doc.ref.path, e);
      result.errors += 1;
    }
  }

  return result;
}
