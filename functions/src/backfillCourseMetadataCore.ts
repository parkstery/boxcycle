import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { parseCoordsFromCourseData } from "./courseGeometryAnchor.js";
import {
  computeRouteFingerprintHex,
  encodeGeometryCoordsJson,
  resolveRouteProfile,
} from "./routeFingerprintCore.js";

const PAGE_SIZE = 200;

export type BackfillCourseMetadataResult = {
  dryRun: boolean;
  scanned: number;
  updated: number;
  skipped: number;
  skipReasons: Record<string, number>;
  errors: number;
  sampleUpdatedIds: string[];
};

function skipReason(result: BackfillCourseMetadataResult, reason: string): void {
  result.skipped += 1;
  result.skipReasons[reason] = (result.skipReasons[reason] ?? 0) + 1;
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export async function backfillCourseMetadataWithAdminSdk(input: {
  dryRun: boolean;
}): Promise<BackfillCourseMetadataResult> {
  const db = getFirestore();
  const result: BackfillCourseMetadataResult = {
    dryRun: input.dryRun,
    scanned: 0,
    updated: 0,
    skipped: 0,
    skipReasons: {},
    errors: 0,
    sampleUpdatedIds: [],
  };

  let lastId: string | undefined;
  while (true) {
    let q = db.collection("courses").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;

    for (const courseDoc of snap.docs) {
      result.scanned += 1;
      const courseId = courseDoc.id;
      const data = courseDoc.data() as Record<string, unknown>;

      const hasFingerprint =
        trimOrNull(data.routeFingerprint)?.length === 64;
      const hasGeometryJson =
        (trimOrNull(data.geometryCoordsJson)?.length ?? 0) >= 10;

      if (hasFingerprint && hasGeometryJson) {
        skipReason(result, "alreadyComplete");
        continue;
      }

      try {
        const coords = parseCoordsFromCourseData(data);
        if (!coords || coords.length < 2) {
          skipReason(result, "noParseableGeometry");
          continue;
        }

        const profile = resolveRouteProfile(data.profile);
        const patch: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (!hasGeometryJson) {
          patch.geometryCoordsJson = encodeGeometryCoordsJson(coords);
        }
        if (!hasFingerprint) {
          patch.routeFingerprint = computeRouteFingerprintHex(coords, profile);
        }

        if (!input.dryRun) {
          await courseDoc.ref.set(patch, { merge: true });
        }
        result.updated += 1;
        if (result.sampleUpdatedIds.length < 10) result.sampleUpdatedIds.push(courseId);
      } catch (e) {
        console.error("[backfillCourseMetadata]", courseId, e);
        result.errors += 1;
      }
    }

    lastId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  return result;
}
