import { FieldPath, getFirestore, Timestamp } from "firebase-admin/firestore";

const PAGE_SIZE = 200;

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export type BackfillRoutePublicationsResult = {
  dryRun: boolean;
  scanned: number;
  created: number;
  skipped: number;
  skipReasons: Record<string, number>;
  errors: number;
  sampleCreatedIds: string[];
};

function skipReason(result: BackfillRoutePublicationsResult, reason: string): void {
  result.skipped += 1;
  result.skipReasons[reason] = (result.skipReasons[reason] ?? 0) + 1;
}

function buildPublicationPayload(courseId: string, data: Record<string, unknown>): Record<string, unknown> | null {
  if (data.status !== "published") return null;

  const geometryCoordsJson = trimOrNull(data.geometryCoordsJson);
  if (!geometryCoordsJson || geometryCoordsJson.length < 10) return null;

  const routeFingerprint = trimOrNull(data.routeFingerprint);
  if (!routeFingerprint || routeFingerprint.length !== 64) return null;

  const routeId = trimOrNull(data.sourceSavedRouteId) ?? courseId;
  const profileRaw = data.profile;
  const snapshotProfile =
    profileRaw === "driving" || profileRaw === "walking" ? profileRaw : "cycling";

  return {
    routeId,
    publicTitle: trimOrNull(data.title) ?? "Untitled",
    publicSummary: trimOrNull(data.description),
    status: "published",
    revision: 1,
    routeFingerprint,
    geometryCoordsJson,
    snapshotProfile,
    snapshotDistanceMeters:
      typeof data.distanceMeters === "number" && Number.isFinite(data.distanceMeters)
        ? data.distanceMeters
        : 0,
    snapshotDurationSec:
      typeof data.durationSec === "number" && Number.isFinite(data.durationSec) ? data.durationSec : 0,
    applicantUid: trimOrNull(data.applicantUid) ?? "",
    sourcePublicRouteRequestId: trimOrNull(data.sourcePublicRouteRequestId) ?? "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function backfillRoutePublicationsWithAdminSdk(input: {
  dryRun: boolean;
}): Promise<BackfillRoutePublicationsResult> {
  const db = getFirestore();
  const result: BackfillRoutePublicationsResult = {
    dryRun: input.dryRun,
    scanned: 0,
    created: 0,
    skipped: 0,
    skipReasons: {},
    errors: 0,
    sampleCreatedIds: [],
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
      const pubRef = db.collection("routePublications").doc(courseId);
      try {
        const existing = await pubRef.get();
        if (existing.exists) {
          skipReason(result, "alreadyExists");
          continue;
        }

        const payload = buildPublicationPayload(courseId, courseDoc.data() as Record<string, unknown>);
        if (!payload) {
          const data = courseDoc.data() as Record<string, unknown>;
          if (data.status !== "published") skipReason(result, "notPublished");
          else if (!trimOrNull(data.geometryCoordsJson)) skipReason(result, "noGeometry");
          else skipReason(result, "noFingerprint");
          continue;
        }

        if (!input.dryRun) {
          await pubRef.set(payload);
        }
        result.created += 1;
        if (result.sampleCreatedIds.length < 10) result.sampleCreatedIds.push(courseId);
      } catch (e) {
        console.error("[backfillRoutePublications]", courseId, e);
        result.errors += 1;
      }
    }

    lastId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  return result;
}
