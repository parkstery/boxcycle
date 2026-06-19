import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";

const PAGE_SIZE = 500;
const BATCH_LIMIT = 500;

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export type PurgePhase7CourseIdFieldsResult = {
  dryRun: boolean;
  rides: { scanned: number; courseIdRemoved: number };
  routePublications: { scanned: number; courseIdRemoved: number };
  publicRouteRequests: { scanned: number; createdCourseIdRemoved: number };
};

async function purgeRidesCourseId(dryRun: boolean): Promise<{ scanned: number; courseIdRemoved: number }> {
  const db = getFirestore();
  let scanned = 0;
  let courseIdRemoved = 0;
  let lastId: string | undefined;

  while (true) {
    let q = db.collection("rides").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;

    const pending: Array<{ ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> }> =
      [];

    for (const doc of snap.docs) {
      scanned += 1;
      const data = doc.data() as Record<string, unknown>;
      const publicationId = trimOrNull(data.publicationId);
      const courseId = trimOrNull(data.courseId);
      if (!publicationId || !courseId) continue;
      if (!dryRun) {
        pending.push({ ref: doc.ref, patch: { courseId: FieldValue.delete() } });
      }
      courseIdRemoved += 1;
    }

    if (!dryRun) {
      for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
        const chunk = pending.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const item of chunk) batch.update(item.ref, item.patch);
        await batch.commit();
      }
    }

    lastId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  return { scanned, courseIdRemoved };
}

async function purgeRoutePublicationsCourseId(
  dryRun: boolean,
): Promise<{ scanned: number; courseIdRemoved: number }> {
  const db = getFirestore();
  let scanned = 0;
  let courseIdRemoved = 0;
  let lastId: string | undefined;

  while (true) {
    let q = db.collection("routePublications").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;

    const pending: Array<{ ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> }> =
      [];

    for (const doc of snap.docs) {
      scanned += 1;
      const data = doc.data() as Record<string, unknown>;
      if (!trimOrNull(data.courseId)) continue;
      if (!dryRun) {
        pending.push({ ref: doc.ref, patch: { courseId: FieldValue.delete() } });
      }
      courseIdRemoved += 1;
    }

    if (!dryRun) {
      for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
        const chunk = pending.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const item of chunk) batch.update(item.ref, item.patch);
        await batch.commit();
      }
    }

    lastId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  return { scanned, courseIdRemoved };
}

async function purgePublicRouteRequestsCreatedCourseId(
  dryRun: boolean,
): Promise<{ scanned: number; createdCourseIdRemoved: number }> {
  const db = getFirestore();
  let scanned = 0;
  let createdCourseIdRemoved = 0;
  let lastId: string | undefined;

  while (true) {
    let q = db.collection("publicRouteRequests").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;

    const pending: Array<{ ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> }> =
      [];

    for (const doc of snap.docs) {
      scanned += 1;
      const data = doc.data() as Record<string, unknown>;
      if (!trimOrNull(data.createdCourseId)) continue;
      if (!dryRun) {
        pending.push({ ref: doc.ref, patch: { createdCourseId: FieldValue.delete() } });
      }
      createdCourseIdRemoved += 1;
    }

    if (!dryRun) {
      for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
        const chunk = pending.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const item of chunk) batch.update(item.ref, item.patch);
        await batch.commit();
      }
    }

    lastId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  return { scanned, createdCourseIdRemoved };
}

export async function purgePhase7CourseIdFieldsWithAdminSdk(input: {
  dryRun: boolean;
}): Promise<PurgePhase7CourseIdFieldsResult> {
  const rides = await purgeRidesCourseId(input.dryRun);
  const routePublications = await purgeRoutePublicationsCourseId(input.dryRun);
  const publicRouteRequests = await purgePublicRouteRequestsCreatedCourseId(input.dryRun);
  return { dryRun: input.dryRun, rides, routePublications, publicRouteRequests };
}
