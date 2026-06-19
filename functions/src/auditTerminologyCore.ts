import { FieldPath, getFirestore } from "firebase-admin/firestore";

const PAGE_SIZE = 500;

function strField(data: Record<string, unknown>, key: string): string | null {
  const v = data[key];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

async function countCollectionDocs(collectionId: string): Promise<number> {
  const db = getFirestore();
  let count = 0;
  let lastId: string | undefined;
  while (true) {
    let q = db.collection(collectionId).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;
    count += snap.size;
    lastId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }
  return count;
}

async function listCollectionDocIds(collectionId: string): Promise<string[]> {
  const db = getFirestore();
  const ids: string[] = [];
  let lastId: string | undefined;
  while (true) {
    let q = db.collection(collectionId).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) ids.push(doc.id);
    lastId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }
  return ids;
}

export type AuditTerminologyResult = {
  collections: {
    rooms: number;
    trails: number;
    rides: number;
    courses: number;
    routePublications: number;
    routeActivity: number;
    publicationPresence: number;
  };
  roomsVsTrails: {
    roomIdsMissingTrailDoc: number;
    trailIdsWithoutRoomDoc: number;
    sampleMissingTrailIds: string[];
  };
  ridesFields: {
    withRoomId: number;
    withTrailId: number;
    userRouteIdOnly: number;
    routeIdOnly: number;
    userRouteIdRouteIdMismatch: number;
    courseIdOnly: number;
    publicationIdOnly: number;
    courseIdPublicationIdMismatch: number;
    bothRouteIdsMatch: number;
    bothPublicationIdsMatch: number;
  };
  coursesVsPublications: {
    /** `courses` 컬렉션 잔존 문서 수 — Phase 7 Gate 0 기대값 0 */
    coursesCollectionRemaining: number;
    routePublicationsWithCourseIdField: number;
    trailsWithCourseIdOnly: number;
    trailsOpenMissingPublicationId: number;
    openTrailListingsWithCourseIdOnly: number;
  };
};

export async function auditTerminologyWithAdminSdk(): Promise<AuditTerminologyResult> {
  const db = getFirestore();

  const [
    rooms,
    trails,
    rides,
    courses,
    routePublications,
    routeActivity,
    publicationPresence,
  ] = await Promise.all([
    countCollectionDocs("rooms"),
    countCollectionDocs("trails"),
    countCollectionDocs("rides"),
    countCollectionDocs("courses"),
    countCollectionDocs("routePublications"),
    countCollectionDocs("routeActivity"),
    countCollectionDocs("publicationPresence"),
  ]);

  const roomIds = rooms > 0 ? await listCollectionDocIds("rooms") : [];
  const trailIdSet = new Set(trails > 0 ? await listCollectionDocIds("trails") : []);
  const missingTrailIds: string[] = [];
  for (const roomId of roomIds) {
    if (!trailIdSet.has(roomId)) missingTrailIds.push(roomId);
  }
  let trailIdsWithoutRoomDoc = 0;
  if (rooms > 0) {
    const roomIdSet = new Set(roomIds);
    for (const trailId of trailIdSet) {
      if (!roomIdSet.has(trailId)) trailIdsWithoutRoomDoc += 1;
    }
  } else {
    trailIdsWithoutRoomDoc = trailIdSet.size;
  }

  const ridesFields = {
    withRoomId: 0,
    withTrailId: 0,
    userRouteIdOnly: 0,
    routeIdOnly: 0,
    userRouteIdRouteIdMismatch: 0,
    courseIdOnly: 0,
    publicationIdOnly: 0,
    courseIdPublicationIdMismatch: 0,
    bothRouteIdsMatch: 0,
    bothPublicationIdsMatch: 0,
  };

  let lastRideId: string | undefined;
  while (true) {
    let q = db.collection("rides").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastRideId) q = q.startAfter(lastRideId);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (strField(data, "roomId")) ridesFields.withRoomId += 1;
      if (strField(data, "trailId")) ridesFields.withTrailId += 1;

      const userRouteId = strField(data, "userRouteId");
      const routeId = strField(data, "routeId");
      if (userRouteId && !routeId) ridesFields.userRouteIdOnly += 1;
      if (routeId && !userRouteId) ridesFields.routeIdOnly += 1;
      if (userRouteId && routeId) {
        if (userRouteId === routeId) ridesFields.bothRouteIdsMatch += 1;
        else ridesFields.userRouteIdRouteIdMismatch += 1;
      }

      const courseId = strField(data, "courseId");
      const publicationId = strField(data, "publicationId");
      if (courseId && !publicationId) ridesFields.courseIdOnly += 1;
      if (publicationId && !courseId) ridesFields.publicationIdOnly += 1;
      if (courseId && publicationId) {
        if (courseId === publicationId) ridesFields.bothPublicationIdsMatch += 1;
        else ridesFields.courseIdPublicationIdMismatch += 1;
      }
    }
    lastRideId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  const publicationLegacy = {
    coursesCollectionRemaining: courses,
    routePublicationsWithCourseIdField: 0,
    trailsWithCourseIdOnly: 0,
    trailsOpenMissingPublicationId: 0,
    openTrailListingsWithCourseIdOnly: 0,
  };

  let lastPublicationId: string | undefined;
  while (true) {
    let q = db.collection("routePublications").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastPublicationId) q = q.startAfter(lastPublicationId);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (strField(data, "courseId")) publicationLegacy.routePublicationsWithCourseIdField += 1;
    }
    lastPublicationId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  let lastTrailId: string | undefined;
  while (true) {
    let q = db.collection("trails").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastTrailId) q = q.startAfter(lastTrailId);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const courseId = strField(data, "courseId");
      const publicationId = strField(data, "publicationId");
      if (courseId && !publicationId) publicationLegacy.trailsWithCourseIdOnly += 1;
      if (data.visibility === "open" && !publicationId) {
        publicationLegacy.trailsOpenMissingPublicationId += 1;
      }
    }
    lastTrailId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  let lastListingId: string | undefined;
  while (true) {
    let q = db.collection("openTrailListings").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastListingId) q = q.startAfter(lastListingId);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const courseId = strField(data, "courseId");
      const publicationId = strField(data, "publicationId");
      if (courseId && !publicationId) publicationLegacy.openTrailListingsWithCourseIdOnly += 1;
    }
    lastListingId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  return {
    collections: {
      rooms,
      trails,
      rides,
      courses,
      routePublications,
      routeActivity,
      publicationPresence,
    },
    roomsVsTrails: {
      roomIdsMissingTrailDoc: missingTrailIds.length,
      trailIdsWithoutRoomDoc,
      sampleMissingTrailIds: missingTrailIds.slice(0, 10),
    },
    ridesFields,
    coursesVsPublications: publicationLegacy,
  };
}
